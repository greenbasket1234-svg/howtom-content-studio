// ============================================================
// HOWTOM 콘텐츠 제작소 — PHASE 1 최소 서버
// ------------------------------------------------------------
// 이 서버는 PHASE 1에서 아래 3가지만 담당합니다.
//   1) 관리자 로그인 (Universe와 동일 환경변수 사용)
//   2) 공통 PostgreSQL의 광고주 목록 읽기
//   3) dist/ 정적 파일 + SPA 라우팅 서빙
//
// 블로그/광고제작/레퍼런스/AI/자산 API는 아직 구현하지 않습니다.
// 기존 콘텐츠 기능은 PHASE 2 이전 완료 전까지 Universe에 그대로 유지합니다.
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
  console.warn('[안내] DATABASE_URL이 없어 광고주 목록은 빈 배열로 반환됩니다.');
}

let cachedTenantId = null;
async function getCurrentTenantId() {
  if (cachedTenantId) return cachedTenantId;
  if (!pgPool) return null;
  const result = await pgPool.query(`SELECT id FROM tenants WHERE slug = 'howtom' LIMIT 1`);
  cachedTenantId = result.rows[0]?.id || null;
  return cachedTenantId;
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

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serveStatic(pathname, res) {
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(DIST_DIR, requested);
  if (!filePath.startsWith(path.resolve(DIST_DIR))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (!error) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      res.end(data);
      return;
    }
    fs.readFile(path.join(DIST_DIR, 'index.html'), (indexError, indexData) => {
      if (indexError) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Content Studio build not found. Run npm run build first.');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(indexData);
    });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url || '/', 'http://localhost');

    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, {
        ok: true,
        service: 'howtom-content-studio',
        phase: 1,
        databaseConfigured: Boolean(DATABASE_URL),
      });
    }

    if (req.method === 'POST' && pathname === '/api/login') {
      if (!JWT_SECRET || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
        return sendJson(res, 500, { error: '로그인 환경변수(JWT_SECRET, HOWTOM_ADMIN_EMAIL, HOWTOM_ADMIN_PASSWORD)를 설정하세요.' });
      }
      const body = await readJson(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!timingSafeStringEqual(email, ADMIN_EMAIL.toLowerCase()) || !timingSafeStringEqual(password, ADMIN_PASSWORD)) {
        return sendJson(res, 401, { error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
      }
      const token = signToken({
        email,
        name: ADMIN_NAME,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
      });
      return sendJson(res, 200, { token, user: { email, name: ADMIN_NAME } });
    }

    if (pathname.startsWith('/api/')) {
      const payload = requireAuth(req);
      if (!payload) return sendJson(res, 401, { error: '인증이 필요합니다.' });

      if (req.method === 'GET' && pathname === '/api/advertisers') {
        if (!pgPool) return sendJson(res, 200, []);
        const tenantId = await getCurrentTenantId();
        if (!tenantId) return sendJson(res, 200, []);
        const result = await pgPool.query(
          `SELECT id::text AS id, name FROM advertisers WHERE tenant_id = $1 ORDER BY name`,
          [tenantId],
        );
        return sendJson(res, 200, result.rows);
      }

      return sendJson(res, 404, { error: 'PHASE 1에서 제공하지 않는 API입니다.' });
    }

    serveStatic(pathname, res);
  } catch (error) {
    console.error('[Content Studio]', error);
    sendJson(res, 500, { error: error instanceof Error ? error.message : '서버 오류가 발생했습니다.' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[HOWTOM Content Studio] PHASE 1 server listening on :${PORT}`);
});

process.on('SIGTERM', async () => {
  try { await pgPool?.end(); } catch {}
  server.close(() => process.exit(0));
});
