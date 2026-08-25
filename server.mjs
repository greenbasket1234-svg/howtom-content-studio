// ============================================================
// HOWTOM 콘텐츠 제작소 — PHASE 2A 서버
// ------------------------------------------------------------
// 현재 실제 기능:
//   1) 관리자 로그인
//   2) 공통 PostgreSQL 광고주 조회
//   3) 블로그 제작 프로젝트/문체/사진자산 CRUD
//   4) dist/ 정적 파일 + SPA 라우팅
//
// AI 원고 생성은 아직 연결하지 않습니다. 정확한 수치/콘텐츠 데이터는
// PostgreSQL을 Source of Truth로 사용하고, 후속 단계에서 공통 AI Gateway를 붙입니다.
// ============================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4100);
const DIST_DIR = path.join(__dirname, 'dist');

const JWT_SECRET = process.env.JWT_SECRET || '';
const ADMIN_EMAIL = process.env.HOWTOM_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.HOWTOM_ADMIN_PASSWORD || '';
const ADMIN_NAME = process.env.HOWTOM_ADMIN_NAME || '관리자';
const DATABASE_URL = process.env.DATABASE_URL || '';

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64urlDecode(input) {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}
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
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(base64urlDecode(body));
    if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
function timingSafeStringEqual(a, b) {
  const aBuf = Buffer.from(String(a));
  const bBuf = Buffer.from(String(b));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}
function cleanText(value, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}
function makeId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

let pgPool = null;
if (DATABASE_URL) {
  try {
    const pg = await import('pg');
    pgPool = new pg.default.Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
    });
  } catch (error) {
    console.error('[오류] PostgreSQL 연결 모듈을 초기화하지 못했습니다:', error?.message || error);
  }
} else {
  console.warn('[안내] DATABASE_URL이 없어 DB 기능은 사용할 수 없습니다.');
}

let cachedTenantId = null;
async function getCurrentTenantId() {
  if (cachedTenantId) return cachedTenantId;
  if (!pgPool) return null;
  const result = await pgPool.query(`SELECT id FROM tenants WHERE slug = 'howtom' LIMIT 1`);
  cachedTenantId = result.rows[0]?.id || null;
  return cachedTenantId;
}

async function ensureBlogTables() {
  if (!pgPool) return;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS blog_projects (
      id TEXT PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      advertiser_id UUID REFERENCES advertisers(id) ON DELETE SET NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_blog_projects_tenant ON blog_projects(tenant_id);
    CREATE TABLE IF NOT EXISTS blog_styles (
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (tenant_id, advertiser_id)
    );
    CREATE TABLE IF NOT EXISTS blog_assets (
      id TEXT PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}
if (pgPool) {
  ensureBlogTables().catch(error => console.error('[Content Studio] blog table check failed:', error?.message || error));
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
async function readJson(req) {
  return await new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1024 * 1024) reject(new Error('요청 본문이 너무 큽니다.'));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('JSON 형식이 올바르지 않습니다.')); }
    });
    req.on('error', reject);
  });
}
function requireAuth(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return null;
  return verifyToken(header.slice(7));
}
function requireDb(res) {
  if (!pgPool) {
    sendJson(res, 503, { error: 'DATABASE_URL이 설정되지 않아 데이터베이스 기능을 사용할 수 없습니다.' });
    return false;
  }
  return true;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
};
function serveStatic(pathname, res) {
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(DIST_DIR, requested);
  if (!filePath.startsWith(path.resolve(DIST_DIR))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, (error, data) => {
    if (!error) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      res.end(data); return;
    }
    fs.readFile(path.join(DIST_DIR, 'index.html'), (indexError, indexData) => {
      if (indexError) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Content Studio build not found. Run npm run build first.'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(indexData);
    });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url || '/', 'http://localhost');

    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, service: 'howtom-content-studio', phase: '2A-blog', databaseConfigured: Boolean(DATABASE_URL), aiConfigured: false });
    }

    if (req.method === 'POST' && pathname === '/api/login') {
      if (!JWT_SECRET || !ADMIN_EMAIL || !ADMIN_PASSWORD) return sendJson(res, 500, { error: '로그인 환경변수를 설정하세요.' });
      const body = await readJson(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!timingSafeStringEqual(email, ADMIN_EMAIL.toLowerCase()) || !timingSafeStringEqual(password, ADMIN_PASSWORD)) return sendJson(res, 401, { error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
      const token = signToken({ email, name: ADMIN_NAME, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 });
      return sendJson(res, 200, { token, user: { email, name: ADMIN_NAME } });
    }

    if (pathname.startsWith('/api/')) {
      const payload = requireAuth(req);
      if (!payload) return sendJson(res, 401, { error: '인증이 필요합니다.' });

      if (req.method === 'GET' && pathname === '/api/advertisers') {
        if (!pgPool) return sendJson(res, 200, []);
        const tenantId = await getCurrentTenantId();
        if (!tenantId) return sendJson(res, 200, []);
        const result = await pgPool.query(`
          SELECT a.id::text AS id, a.name,
                 COALESCE(to_jsonb(a)->>'industry','') AS industry,
                 COALESCE(to_jsonb(a)->>'website','') AS website,
                 COALESCE(to_jsonb(a)->>'phone','') AS phone,
                 COALESCE(to_jsonb(a)->>'address','') AS address
          FROM advertisers a WHERE a.tenant_id=$1 ORDER BY a.name
        `, [tenantId]);
        return sendJson(res, 200, result.rows);
      }

      if (pathname.startsWith('/api/blog/')) {
        if (!requireDb(res)) return;
        const tenantId = await getCurrentTenantId();
        if (!tenantId) return sendJson(res, 409, { error: 'HOWTOM tenant를 찾을 수 없습니다.' });

        if (req.method === 'GET' && pathname === '/api/blog/projects') {
          const r = await pgPool.query(`SELECT id, data FROM blog_projects WHERE tenant_id=$1 ORDER BY created_at DESC`, [tenantId]);
          return sendJson(res, 200, r.rows.map(row => ({ ...(row.data || {}), projectId: row.id })));
        }
        if (req.method === 'POST' && pathname === '/api/blog/projects') {
          const body = await readJson(req); const stamp = new Date().toISOString();
          const row = {
            projectId: makeId('blog'), advertiserId: cleanText(body.advertiserId, 120), advertiserName: cleanText(body.advertiserName, 120),
            industry: cleanText(body.industry || '일반 서비스업', 120), platform: cleanText(body.platform || '네이버 블로그', 120), contentType: cleanText(body.contentType || '정보형 블로그', 120),
            purpose: cleanText(body.purpose || '정보 제공', 120), primaryKeyword: cleanText(body.primaryKeyword || '', 200), secondaryKeywords: Array.isArray(body.secondaryKeywords) ? body.secondaryKeywords.map(x => cleanText(x, 100)).filter(Boolean).slice(0, 20) : [],
            region: cleanText(body.region || '', 120), targetLength: Number(body.targetLength || 2000), tone: cleanText(body.tone || '광고주 문체 자동 적용', 120), referenceText: cleanText(body.referenceText || '', 20000),
            options: { style: true, advertiserInfo: true, photos: true, compliance: true, seo: true, medical: false, ...(body.options || {}) },
            titleOptions: [], selectedTitle: '', blocks: [], status: 'draft', complianceStatus: 'not-reviewed', medicalReview: { required: null, status: 'not-reviewed', reviewNumber: '', reviewedAt: '', locked: false },
            seoScore: 0, complianceIssues: [], assetIds: [], publishStatus: 'draft', scheduledAt: '', publishedUrl: '', createdAt: stamp, updatedAt: stamp,
          };
          if (!row.advertiserId) return sendJson(res, 400, { error: '광고주를 선택하세요.' });
          const advRes = await pgPool.query(`SELECT id FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, row.advertiserId]);
          if (!advRes.rows[0]) return sendJson(res, 400, { error: '선택한 광고주를 찾을 수 없습니다.' });
          await pgPool.query(`INSERT INTO blog_projects (id, tenant_id, advertiser_id, data) VALUES ($1,$2,$3,$4)`, [row.projectId, tenantId, advRes.rows[0].id, JSON.stringify(row)]);
          return sendJson(res, 201, row);
        }

        const projectMatch = pathname.match(/^\/api\/blog\/projects\/([^/]+)$/);
        if (projectMatch && req.method === 'GET') {
          const id = decodeURIComponent(projectMatch[1]);
          const r = await pgPool.query(`SELECT id, data FROM blog_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          return r.rows[0] ? sendJson(res, 200, { ...(r.rows[0].data || {}), projectId: r.rows[0].id }) : sendJson(res, 404, { error: '블로그 프로젝트를 찾을 수 없습니다.' });
        }
        if (projectMatch && (req.method === 'PATCH' || req.method === 'PUT')) {
          const id = decodeURIComponent(projectMatch[1]); const patch = await readJson(req);
          const cur = await pgPool.query(`SELECT data FROM blog_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          const current = cur.rows[0]?.data;
          if (!current) return sendJson(res, 404, { error: '블로그 프로젝트를 찾을 수 없습니다.' });
          if (current.medicalReview?.locked && (patch.blocks || patch.selectedTitle) && !patch.unlockForRevision) return sendJson(res, 409, { error: '심의 완료 문안이 잠겨 있습니다. 재검토로 전환한 뒤 수정하세요.' });
          const safePatch = { ...patch }; delete safePatch.projectId; delete safePatch.createdAt; delete safePatch.unlockForRevision;
          const updated = { ...current, ...safePatch, projectId: id, updatedAt: new Date().toISOString() };
          await pgPool.query(`UPDATE blog_projects SET data=$3, updated_at=now() WHERE tenant_id=$1 AND id=$2`, [tenantId, id, JSON.stringify(updated)]);
          return sendJson(res, 200, updated);
        }
        if (projectMatch && req.method === 'DELETE') {
          const id = decodeURIComponent(projectMatch[1]);
          await pgPool.query(`DELETE FROM blog_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          return sendJson(res, 200, { ok: true });
        }

        if (req.method === 'GET' && pathname === '/api/blog/ai-status') return sendJson(res, 200, { configured: false, provider: null });
        if (req.method === 'POST' && pathname === '/api/blog/generate') return sendJson(res, 409, { error: 'AI 원고 생성은 후속 단계에서 공통 AI Gateway로 연결합니다. 현재는 직접 작성·편집 기능을 사용하세요.' });

        const styleMatch = pathname.match(/^\/api\/blog\/styles\/([^/]+)$/);
        if (styleMatch && req.method === 'GET') {
          const advertiserId = decodeURIComponent(styleMatch[1]);
          const r = await pgPool.query(`SELECT data FROM blog_styles WHERE tenant_id=$1 AND advertiser_id::text=$2`, [tenantId, advertiserId]);
          return sendJson(res, 200, r.rows[0]?.data || { advertiserId, tone: '', rules: [], preferredPhrases: [], prohibitedPhrases: [], cta: '', sourceTexts: [] });
        }
        if (styleMatch && req.method === 'PUT') {
          const advertiserId = decodeURIComponent(styleMatch[1]); const body = await readJson(req);
          const advRes = await pgPool.query(`SELECT id FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, advertiserId]);
          if (!advRes.rows[0]) return sendJson(res, 400, { error: '광고주를 찾을 수 없습니다.' });
          const updated = { ...body, advertiserId, updatedAt: new Date().toISOString() };
          await pgPool.query(`INSERT INTO blog_styles (tenant_id, advertiser_id, data) VALUES ($1,$2,$3) ON CONFLICT (tenant_id, advertiser_id) DO UPDATE SET data=EXCLUDED.data`, [tenantId, advRes.rows[0].id, JSON.stringify(updated)]);
          return sendJson(res, 200, updated);
        }

        if (req.method === 'GET' && pathname === '/api/blog/assets') {
          const r = await pgPool.query(`SELECT id, data FROM blog_assets WHERE tenant_id=$1 ORDER BY created_at DESC`, [tenantId]);
          return sendJson(res, 200, r.rows.map(row => ({ ...(row.data || {}), assetId: row.id })));
        }
        if (req.method === 'POST' && pathname === '/api/blog/assets') {
          const body = await readJson(req);
          const row = { assetId: makeId('asset'), advertiserId: cleanText(body.advertiserId, 120), name: cleanText(body.name, 200), url: cleanText(body.url, 1000), tags: Array.isArray(body.tags) ? body.tags.map(x => cleanText(x, 80)).filter(Boolean) : [], createdAt: new Date().toISOString() };
          if (!row.advertiserId || !row.name) return sendJson(res, 400, { error: '광고주와 자산명을 입력하세요.' });
          const advRes = await pgPool.query(`SELECT id FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, row.advertiserId]);
          if (!advRes.rows[0]) return sendJson(res, 400, { error: '광고주를 찾을 수 없습니다.' });
          await pgPool.query(`INSERT INTO blog_assets (id, tenant_id, data) VALUES ($1,$2,$3)`, [row.assetId, tenantId, JSON.stringify(row)]);
          return sendJson(res, 201, row);
        }
      }

      return sendJson(res, 404, { error: '현재 단계에서 제공하지 않는 API입니다.' });
    }

    serveStatic(pathname, res);
  } catch (error) {
    console.error('[Content Studio]', error);
    sendJson(res, 500, { error: error instanceof Error ? error.message : '서버 오류가 발생했습니다.' });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`[HOWTOM Content Studio] PHASE 2A blog server listening on :${PORT}`));
process.on('SIGTERM', async () => { try { await pgPool?.end(); } catch {} server.close(() => process.exit(0)); });
