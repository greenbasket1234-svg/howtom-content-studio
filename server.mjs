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
