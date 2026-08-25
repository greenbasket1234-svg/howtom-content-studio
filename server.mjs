// ============================================================
// HOWTOM 콘텐츠 제작소 — 최소 서버 (PHASE 1)
// ------------------------------------------------------------
// 이 서버는 일부러 아주 단순합니다. Universe의 server.mjs를 복사하지 않았고,
// 딱 3가지만 합니다:
//   1) 로그인 (Universe와 완전히 같은 방식 - 같은 JWT_SECRET/관리자 계정 사용)
//   2) 광고주 목록 조회 (같은 Postgres DB에서 읽기만 함, Universe 서버는 호출하지 않음)
//   3) 빌드된 프론트엔드(dist/) 정적 파일 서빙
//
// Universe의 광고 성과·캠페인·소재 등 그 어떤 기능도 여기서 다시 구현하지 않습니다.
// 그 기능들은 앞으로도 계속 Universe에만 존재합니다.
// ============================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4100);

// --- 인증: Universe와 완전히 같은 방식(같은 환경변수)을 씁니다. 로그인 세션 자체는
// 도메인이 달라 공유되지 않지만, "같은 계정으로 각자 로그인"하는 구조라 헷갈리지 않습니다. ---
const JWT_SECRET = process.env.JWT_SECRET || '';
const ADMIN_EMAIL = process.env.HOWTOM_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.HOWTOM_ADMIN_PASSWORD || '';
const ADMIN_NAME = process.env.HOWTOM_ADMIN_NAME || '관리자';

function base64url(input) { return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function base64urlDecode(input) { return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); }
function signToken(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${header}.${body}.${signature}`;
}
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sigBuf = Buffer.from(signature); const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(base64urlDecode(body));
    if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch { return null; }
}
function timingSafeStringEqual(a, b) {
  const aBuf = Buffer.from(String(a)); const bBuf = Buffer.from(String(b));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

// --- DB: Universe와 같은 DATABASE_URL을 그대로 씁니다. 같은 DB, 다른 프로세스입니다. ---
const DATABASE_URL = process.env.DATABASE_URL || '';
let pgPool = null;
if (DATABASE_URL) {
  try {
    const pg = await import('pg');
    // 두 서버가 같은 DB에 동시 접속하므로, 커넥션 풀을 작게 제한합니다(Universe 쪽 풀을 압박하지 않도록).
    pgPool = new pg.default.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 });
  } catch (error) {
    console.error('[오류] DATABASE_URL이 설정됐지만 pg 패키지를 불러오지 못했습니다:', error?.message || error);
  }
} else {
  console.warn('[안내] DATABASE_URL이 설정되지 않아 광고주 목록을 조회할 수 없습니다.');
}
let cachedTenantId = null;
async function getCurrentTenantId() {
  if (cachedTenantId) return cachedTenantId;
  if (!pgPool) return null;
  const res = await pgPool.query(`SELECT id FROM tenants WHERE slug = 'howtom' LIMIT 1`);
  cachedTenantId = res.rows[0]?.id || null;
  return cachedTenantId;
}

// --- 블로그 AI 원고 생성 -----------------------------------------------------------
// Universe의 server.mjs와 완전히 같은 방식(같은 환경변수, 같은 AI 호출 로직)을 씁니다.
// 두 서버가 서로 호출하지 않고, 각자 독립적으로 같은 외부 AI API에 요청합니다.
const BLOG_AI_PROVIDER = (process.env.BLOG_AI_PROVIDER || '').trim().toLowerCase();
const BLOG_AI_API_KEY = process.env.BLOG_AI_API_KEY || '';
const BLOG_AI_API_URL = process.env.BLOG_AI_API_URL || '';
const BLOG_AI_MODEL = process.env.BLOG_AI_MODEL || '';
function blogAiConfigured() {
  if (BLOG_AI_PROVIDER === 'anthropic' || BLOG_AI_PROVIDER === 'openai') return Boolean(BLOG_AI_API_KEY);
  if (BLOG_AI_PROVIDER === 'custom') return Boolean(BLOG_AI_API_URL);
  return false;
}
function blogAiStatus() { return { configured: blogAiConfigured(), provider: BLOG_AI_PROVIDER || null }; }
function makeId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function cleanText(value, max = 2000) { return String(value ?? '').trim().slice(0, max); }

function parseAiJson(text) {
  const cleaned = String(text ?? '').replace(/```json/gi, '').replace(/```/g, '').trim();
  let parsed;
  try { parsed = JSON.parse(cleaned); } catch { throw new Error('AI 응답을 JSON으로 해석할 수 없습니다.'); }
  if (!Array.isArray(parsed.titles) || !Array.isArray(parsed.blocks)) throw new Error('AI 응답 형식이 올바르지 않습니다. (titles, blocks 필요)');
  return {
    titles: parsed.titles.slice(0, 5).map(t => cleanText(String(t), 200)),
    blocks: parsed.blocks.slice(0, 10).map(b => ({ blockId: makeId('block'), type: cleanText(String(b?.type || 'paragraph'), 20), title: cleanText(String(b?.title || ''), 200), text: cleanText(String(b?.text || ''), 4000) })),
  };
}
function buildBlogAiPrompts(brief) {
  const system = `당신은 ${brief.industry || '업종 무관'} 업종 광고주를 위한 ${brief.platform || '블로그'} 원고를 쓰는 전문 카피라이터입니다.\n과장·단정 표현, 치료효과 단정, 비교·비방 표현은 피하고 확인 가능한 사실 중심으로 작성합니다.\n반드시 아래 JSON 형식으로만 응답하세요. 그 외 설명 문장이나 코드블록 표시(\`\`\`)는 절대 포함하지 마세요.\n{"titles": ["제목1", "제목2", "제목3"], "blocks": [{"type": "paragraph|h2|faq|cta", "title": "블록 제목", "text": "본문"}]}\nblocks는 도입 1개, 핵심정보 h2 1개 이상, 확인사항 h2 1개, FAQ 1개, CTA 1개를 포함해 5~7개로 구성하세요.`;
  const user = `광고주명: ${brief.advertiser}\n업종: ${brief.industry || '미지정'}\n플랫폼: ${brief.platform || '미지정'}\n콘텐츠 유형: ${brief.contentType || '정보형'}\n메인 키워드: ${brief.keyword}\n서브 키워드: ${(brief.secondaryKeywords || []).join(', ') || '없음'}\n지역: ${brief.region || '없음'}\n목표 글자 수: 약 ${brief.targetLength || 2000}자\n톤앤매너: ${brief.tone || '자연스러운 정보 전달형'}`;
  return { system, user };
}
async function callExternalBlogAi(brief) {
  const { system, user } = buildBlogAiPrompts(brief);
  if (BLOG_AI_PROVIDER === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'x-api-key': BLOG_AI_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: BLOG_AI_MODEL || 'claude-sonnet-4-6', max_tokens: 2200, system, messages: [{ role: 'user', content: user }] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Anthropic API HTTP ${res.status}`);
    const text = Array.isArray(data.content) ? data.content.map(b => b.text || '').join('') : '';
    return parseAiJson(text);
  }
  if (BLOG_AI_PROVIDER === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${BLOG_AI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: BLOG_AI_MODEL || 'gpt-4o-mini', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.7 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `OpenAI API HTTP ${res.status}`);
    return parseAiJson(data?.choices?.[0]?.message?.content || '');
  }
  if (BLOG_AI_PROVIDER === 'custom') {
    const res = await fetch(BLOG_AI_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemPrompt: system, userPrompt: user, brief }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `외부 AI API HTTP ${res.status}`);
    if (Array.isArray(data.titles) && Array.isArray(data.blocks)) return { titles: data.titles.slice(0, 5).map(t => cleanText(String(t), 200)), blocks: data.blocks.slice(0, 10).map(b => ({ blockId: makeId('block'), type: cleanText(String(b?.type || 'paragraph'), 20), title: cleanText(String(b?.title || ''), 200), text: cleanText(String(b?.text || ''), 4000) })) };
    return parseAiJson(JSON.stringify(data));
  }
  throw new Error('BLOG_AI_PROVIDER가 설정되지 않았습니다.');
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}
function requireAuth(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return verifyToken(token);
}

const DIST_DIR = path.join(__dirname, 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
function serveStatic(req, res, pathname) {
  const filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);
  const safePath = path.normalize(filePath);
  if (!safePath.startsWith(DIST_DIR)) { res.writeHead(403); res.end(); return; }
  fs.readFile(safePath, (err, data) => {
    if (err) {
      // SPA 라우팅: 파일이 없으면 index.html로 폴백합니다(React Router가 클라이언트에서 처리).
      fs.readFile(path.join(DIST_DIR, 'index.html'), (err2, indexData) => {
        if (err2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(indexData);
      });
      return;
    }
    const ext = path.extname(safePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');

    if (pathname === '/api/health') return sendJson(res, 200, { ok: true, service: 'howtom-content-studio' });

    if (req.method === 'POST' && pathname === '/api/login') {
      if (!JWT_SECRET || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
        return sendJson(res, 500, { error: '서버에 로그인 정보가 설정되지 않았습니다. Universe와 같은 HOWTOM_ADMIN_EMAIL/PASSWORD/JWT_SECRET 환경변수를 설정하세요.' });
      }
      const body = await readJson(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!timingSafeStringEqual(email, ADMIN_EMAIL.toLowerCase()) || !timingSafeStringEqual(password, ADMIN_PASSWORD)) {
        return sendJson(res, 401, { error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
      }
      const token = signToken({ email, name: ADMIN_NAME, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 });
      return sendJson(res, 200, { token, user: { email, name: ADMIN_NAME } });
    }

    // 이 아래 API는 로그인이 필요합니다.
    if (pathname.startsWith('/api/')) {
      const payload = requireAuth(req);
      if (!payload) return sendJson(res, 401, { error: '인증이 필요합니다.' });

      // 광고주 목록: Universe와 완전히 같은 테이블을 그대로 읽기만 합니다. 새로 만들지 않습니다.
      if (req.method === 'GET' && pathname === '/api/advertisers') {
        if (!pgPool) return sendJson(res, 200, []);
        const tenantId = await getCurrentTenantId();
        if (!tenantId) return sendJson(res, 200, []);
        const result = await pgPool.query(`SELECT id, name FROM advertisers WHERE tenant_id = $1 ORDER BY name`, [tenantId]);
        return sendJson(res, 200, result.rows);
      }

      // 블로그: Universe가 이미 만들어둔 blog_projects 테이블(같은 DB)을 그대로 씁니다.
      if (req.method === 'GET' && pathname === '/api/blog/projects') {
        if (!pgPool) return sendJson(res, 200, []);
        const tenantId = await getCurrentTenantId();
        const r = await pgPool.query(`SELECT id, data FROM blog_projects WHERE tenant_id=$1 ORDER BY created_at DESC`, [tenantId]);
        return sendJson(res, 200, r.rows.map(row => ({ ...(row.data || {}), projectId: row.id })));
      }
      if (req.method === 'POST' && pathname === '/api/blog/projects') {
        if (!pgPool) return sendJson(res, 400, { error: 'DATABASE_URL이 설정되지 않았습니다.' });
        const body = await readJson(req); const stamp = new Date().toISOString();
        const row = {
          projectId: makeId('blog'), advertiserId: cleanText(body.advertiserId, 120), advertiserName: cleanText(body.advertiserName, 120),
          industry: cleanText(body.industry || '일반 서비스업', 120), platform: cleanText(body.platform || '네이버 블로그', 120), contentType: cleanText(body.contentType || '정보형 블로그', 120),
          purpose: cleanText(body.purpose || '정보 제공', 120), primaryKeyword: cleanText(body.primaryKeyword || '', 200),
          secondaryKeywords: Array.isArray(body.secondaryKeywords) ? body.secondaryKeywords.map(x => cleanText(x, 100)).filter(Boolean).slice(0, 20) : [],
          region: cleanText(body.region || '', 120), targetLength: Number(body.targetLength || 2000), tone: cleanText(body.tone || '광고주 문체 자동 적용', 120), referenceText: cleanText(body.referenceText || '', 20000),
          titleOptions: [], selectedTitle: '', blocks: [], status: 'draft', complianceStatus: 'not-reviewed',
          seoScore: 0, complianceIssues: [], publishStatus: 'draft', publishedUrl: '', createdAt: stamp, updatedAt: stamp,
        };
        if (!row.advertiserId) return sendJson(res, 400, { error: '광고주를 선택하세요.' });
        const tenantId = await getCurrentTenantId();
        const advRes = await pgPool.query(`SELECT id FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, row.advertiserId]).catch(() => ({ rows: [] }));
        await pgPool.query(`INSERT INTO blog_projects (id, tenant_id, advertiser_id, data) VALUES ($1,$2,$3,$4)`, [row.projectId, tenantId, advRes.rows[0]?.id || null, JSON.stringify(row)]);
        return sendJson(res, 201, row);
      }
      const blogProjectMatch = pathname.match(/^\/api\/blog\/projects\/([^/]+)$/);
      if (blogProjectMatch && req.method === 'GET') {
        const tenantId = await getCurrentTenantId();
        const r = await pgPool.query(`SELECT data FROM blog_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, decodeURIComponent(blogProjectMatch[1])]);
        return r.rows[0] ? sendJson(res, 200, r.rows[0].data) : sendJson(res, 404, { error: '블로그 프로젝트를 찾을 수 없습니다.' });
      }
      if (blogProjectMatch && (req.method === 'PATCH' || req.method === 'PUT')) {
        const id = decodeURIComponent(blogProjectMatch[1]); const patch = await readJson(req);
        const tenantId = await getCurrentTenantId();
        const cur = await pgPool.query(`SELECT data FROM blog_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
        if (!cur.rows[0]?.data) return sendJson(res, 404, { error: '블로그 프로젝트를 찾을 수 없습니다.' });
        const safePatch = { ...patch }; delete safePatch.projectId; delete safePatch.createdAt;
        const updated = { ...cur.rows[0].data, ...safePatch, updatedAt: new Date().toISOString() };
        await pgPool.query(`UPDATE blog_projects SET data=$3, updated_at=now() WHERE tenant_id=$1 AND id=$2`, [tenantId, id, JSON.stringify(updated)]);
        return sendJson(res, 200, updated);
      }
      if (blogProjectMatch && req.method === 'DELETE') {
        const tenantId = await getCurrentTenantId();
        await pgPool.query(`DELETE FROM blog_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, decodeURIComponent(blogProjectMatch[1])]);
        return sendJson(res, 200, { ok: true });
      }
      if (req.method === 'GET' && pathname === '/api/blog/ai-status') return sendJson(res, 200, blogAiStatus());
      if (req.method === 'POST' && pathname === '/api/blog/generate') {
        const body = await readJson(req); const keyword = cleanText(body.primaryKeyword, 200); const advertiser = cleanText(body.advertiserName || '광고주', 120);
        if (!keyword) return sendJson(res, 400, { error: '메인 키워드를 입력하세요.' });
        if (!blogAiConfigured()) return sendJson(res, 400, { error: '블로그 AI가 연결되지 않았습니다. 관리자가 외부 AI API를 연결해주세요.' });
        try {
          const ai = await callExternalBlogAi({ advertiser, industry: body.industry, platform: body.platform, contentType: body.contentType, keyword, secondaryKeywords: body.secondaryKeywords, region: body.region, targetLength: body.targetLength, tone: body.tone });
          return sendJson(res, 200, { generator: `external-ai:${BLOG_AI_PROVIDER}`, titles: ai.titles, blocks: ai.blocks });
        } catch (error) {
          return sendJson(res, 502, { error: error instanceof Error ? `외부 AI 원고 생성에 실패했습니다: ${error.message}` : '외부 AI 원고 생성에 실패했습니다.' });
        }
      }

      return sendJson(res, 404, { error: 'Not found' });
    }

    serveStatic(req, res, pathname);
  } catch (error) {
    console.error('[처리되지 않은 오류]', error?.message || error);
    sendJson(res, 500, { error: '서버 오류가 발생했습니다.' });
  }
});

server.listen(PORT, () => {
  console.log(`HOWTOM 콘텐츠 제작소 서버 시작: http://localhost:${PORT}`);
});
