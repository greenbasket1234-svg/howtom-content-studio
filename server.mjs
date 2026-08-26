// ============================================================
// HOWTOM 콘텐츠 제작소 — PHASE 2B 서버
// ------------------------------------------------------------
// 현재 실제 기능:
//   1) 관리자 로그인
//   2) 공통 PostgreSQL 광고주 조회
//   3) 블로그 제작 프로젝트/문체/사진자산 CRUD
//   4) 광고 제작 프로젝트 CRUD
//   5) dist/ 정적 파일 + SPA 라우팅
//
// AI 원고 생성은 아직 연결하지 않습니다. 정확한 수치/콘텐츠 데이터는
// PostgreSQL을 Source of Truth로 사용하고, 블로그 AI 원고는 제휴 업체 API 확정 후 연결합니다.
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

const AD_STATUSES = new Set(['draft','in-progress','review','completed','archived']);
function normalizeAdProject(body = {}, current = null) {
  const stamp = new Date().toISOString();
  const base = current || {};
  const stringList = (value, fallback = []) => Array.isArray(value) ? value.map(x => cleanText(x, 500)).slice(0, 20) : fallback;
  const variantsSource = Array.isArray(body.copyVariants) ? body.copyVariants : (Array.isArray(base.copyVariants) ? base.copyVariants : []);
  const copyVariants = variantsSource.slice(0, 3).map((v, index) => ({
    variantId: cleanText(v?.variantId || `variant-${index + 1}`, 120),
    label: cleanText(v?.label || `${String.fromCharCode(65 + index)}안`, 40),
    headline: cleanText(v?.headline || '', 500),
    description: cleanText(v?.description || '', 1000),
    body: cleanText(v?.body || '', 12000),
    cta: cleanText(v?.cta || '더 알아보기', 120),
  }));
  while (copyVariants.length < 3) {
    const index = copyVariants.length;
    copyVariants.push({ variantId:`variant-${index+1}`, label:`${String.fromCharCode(65+index)}안`, headline:'', description:'', body:'', cta:'더 알아보기' });
  }
  const imageSource = body.imagePlan && typeof body.imagePlan === 'object' ? body.imagePlan : (base.imagePlan || {});
  const videoSource = body.videoPlan && typeof body.videoPlan === 'object' ? body.videoPlan : (base.videoPlan || {});
  const statusCandidate = cleanText(body.status ?? base.status ?? 'draft', 40);
  return {
    ...base,
    projectId: base.projectId || cleanText(body.projectId || '', 120),
    title: cleanText(body.title ?? base.title ?? '새 광고 제작', 240),
    advertiserId: cleanText(body.advertiserId ?? base.advertiserId ?? '', 120),
    advertiserName: cleanText(body.advertiserName ?? base.advertiserName ?? '', 160),
    channel: cleanText(body.channel ?? base.channel ?? '메타', 120),
    objective: cleanText(body.objective ?? base.objective ?? 'DB 수집', 120),
    creativeType: cleanText(body.creativeType ?? base.creativeType ?? '정사각형 이미지', 120),
    representativeKpi: cleanText(body.representativeKpi ?? base.representativeKpi ?? 'DB당 비용', 120),
    target: cleanText(body.target ?? base.target ?? '', 3000),
    keyBenefit: cleanText(body.keyBenefit ?? base.keyBenefit ?? '', 3000),
    price: cleanText(body.price ?? base.price ?? '', 1000),
    mandatoryText: cleanText(body.mandatoryText ?? base.mandatoryText ?? '', 6000),
    prohibitedText: cleanText(body.prohibitedText ?? base.prohibitedText ?? '', 6000),
    landingUrl: cleanText(body.landingUrl ?? base.landingUrl ?? '', 2000),
    format: cleanText(body.format ?? base.format ?? '1:1', 80),
    hookType: cleanText(body.hookType ?? base.hookType ?? '', 120),
    hooks: (() => { const values = stringList(body.hooks, Array.isArray(base.hooks) ? base.hooks : ['', '', '']).slice(0, 3); while (values.length < 3) values.push(''); return values; })(),
    copyVariants,
    imagePlan: {
      visualType: cleanText(imageSource.visualType || '', 500), subject: cleanText(imageSource.subject || '', 3000),
      background: cleanText(imageSource.background || '', 3000), mainText: cleanText(imageSource.mainText || '', 1500),
      subText: cleanText(imageSource.subText || '', 1500), ratio: cleanText(imageSource.ratio || '1:1', 80), textRatio: cleanText(imageSource.textRatio || '', 120),
    },
    videoPlan: {
      length: cleanText(videoSource.length || '', 120), style: cleanText(videoSource.style || '', 500),
      hook3s: cleanText(videoSource.hook3s || '', 3000), scenes: cleanText(videoSource.scenes || '', 12000), endingCta: cleanText(videoSource.endingCta || '', 1500),
    },
    referenceIds: stringList(body.referenceIds, Array.isArray(base.referenceIds) ? base.referenceIds : []).slice(0, 100),
    resultAssetIds: stringList(body.resultAssetIds, Array.isArray(base.resultAssetIds) ? base.resultAssetIds : []).slice(0, 100),
    status: AD_STATUSES.has(statusCandidate) ? statusCandidate : 'draft',
    createdAt: base.createdAt || cleanText(body.createdAt || stamp, 80),
    updatedAt: stamp,
  };
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

async function ensureAdTables() {
  if (!pgPool) return;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS ad_projects (
      id TEXT PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      advertiser_id UUID REFERENCES advertisers(id) ON DELETE SET NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_ad_projects_tenant ON ad_projects(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_ad_projects_advertiser ON ad_projects(tenant_id, advertiser_id);
  `);
}

function normalizeTemplate(body = {}, current = null) {
  const base = current || {};
  const blocksSource = Array.isArray(body.blocks) ? body.blocks : (Array.isArray(base.blocks) ? base.blocks : []);
  const blocks = blocksSource.slice(0, 20).map((b, i) => ({
    blockId: cleanText(b?.blockId || `block-${i + 1}`, 60),
    label: cleanText(b?.label || `블록 ${i + 1}`, 120),
    blockType: cleanText(b?.blockType || 'textarea', 30),
    defaultValue: cleanText(b?.defaultValue || '', 4000),
  }));
  const rulesSource = Array.isArray(body.rules) ? body.rules : (Array.isArray(base.rules) ? base.rules : []);
  const rules = rulesSource.slice(0, 10).map(r => ({ field: cleanText(r?.field || '', 60), type: cleanText(r?.type || 'maxLength', 30), value: typeof r?.value === 'number' ? r.value : cleanText(r?.value || '', 200) }));
  const tags = Array.isArray(body.tags) ? body.tags.map(x => cleanText(x, 60)).filter(Boolean).slice(0, 20) : (base.tags || []);
  return {
    ...base,
    templateId: base.templateId || cleanText(body.templateId || '', 120),
    name: cleanText(body.name ?? base.name ?? '새 템플릿', 200),
    templateType: cleanText(body.templateType ?? base.templateType ?? 'ad-copy', 40),
    advertiserId: cleanText(body.advertiserId ?? base.advertiserId ?? '', 120) || null,
    advertiserName: cleanText(body.advertiserName ?? base.advertiserName ?? '', 160),
    channel: cleanText(body.channel ?? base.channel ?? '', 120),
    description: cleanText(body.description ?? base.description ?? '', 500),
    blocks, rules, tags,
    version: Number.isFinite(body.version) ? body.version : (base.version ?? 1),
    isFavorite: typeof body.isFavorite === 'boolean' ? body.isFavorite : (base.isFavorite ?? false),
    useCount: Number.isFinite(body.useCount) ? body.useCount : (base.useCount ?? 0),
    parentTemplateId: cleanText(body.parentTemplateId ?? base.parentTemplateId ?? '', 120) || null,
  };
}

async function ensureTemplateTables() {
  if (!pgPool) return;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS content_templates (
      id TEXT PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      advertiser_id UUID REFERENCES advertisers(id) ON DELETE SET NULL,
      template_type TEXT NOT NULL DEFAULT 'ad-copy',
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_content_templates_tenant ON content_templates(tenant_id);
  `);
}

function normalizeDocumentProject(body = {}, current = null) {
  const base = current || {};
  const blocksSource = Array.isArray(body.blocks) ? body.blocks : (Array.isArray(base.blocks) ? base.blocks : []);
  const blocks = blocksSource.slice(0, 60).map((b, i) => ({
    blockId: cleanText(b?.blockId || `doc-${i + 1}`, 60),
    type: cleanText(b?.type || 'paragraph', 20),
    title: cleanText(b?.title || '', 200),
    text: cleanText(b?.text || '', 8000),
  }));
  return {
    ...base,
    projectId: base.projectId || cleanText(body.projectId || '', 120),
    title: cleanText(body.title ?? base.title ?? '새 문서', 240),
    advertiserId: cleanText(body.advertiserId ?? base.advertiserId ?? '', 120),
    advertiserName: cleanText(body.advertiserName ?? base.advertiserName ?? '', 160),
    documentType: cleanText(body.documentType ?? base.documentType ?? '기획서', 60),
    blocks,
    status: cleanText(body.status ?? base.status ?? 'draft', 40),
  };
}

async function ensureDocumentTables() {
  if (!pgPool) return;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS document_projects (
      id TEXT PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      advertiser_id UUID REFERENCES advertisers(id) ON DELETE SET NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_document_projects_tenant ON document_projects(tenant_id);
  `);
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
  ensureAdTables().catch(error => console.error('[Content Studio] ad table check failed:', error?.message || error));
  ensureTemplateTables().catch(error => console.error('[Content Studio] template table check failed:', error?.message || error));
  ensureDocumentTables().catch(error => console.error('[Content Studio] document table check failed:', error?.message || error));
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
      return sendJson(res, 200, { ok: true, service: 'howtom-content-studio', phase: '2B-blog-ad', databaseConfigured: Boolean(DATABASE_URL), aiConfigured: false });
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

      if (pathname.startsWith('/api/ad/')) {
        if (!requireDb(res)) return;
        const tenantId = await getCurrentTenantId();
        if (!tenantId) return sendJson(res, 409, { error: 'HOWTOM tenant를 찾을 수 없습니다.' });

        if (req.method === 'GET' && pathname === '/api/ad/projects') {
          const r = await pgPool.query(`SELECT id, data FROM ad_projects WHERE tenant_id=$1 ORDER BY updated_at DESC`, [tenantId]);
          return sendJson(res, 200, r.rows.map(row => ({ ...(row.data || {}), projectId: row.id })));
        }
        if (req.method === 'POST' && pathname === '/api/ad/projects') {
          const body = await readJson(req);
          let row = normalizeAdProject(body);
          row.projectId = makeId('ad');
          if (!row.advertiserId) return sendJson(res, 400, { error: '광고주를 선택하세요.' });
          const advRes = await pgPool.query(`SELECT id, name FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, row.advertiserId]);
          if (!advRes.rows[0]) return sendJson(res, 400, { error: '선택한 광고주를 찾을 수 없습니다.' });
          row.advertiserName = advRes.rows[0].name;
          await pgPool.query(`INSERT INTO ad_projects (id, tenant_id, advertiser_id, data) VALUES ($1,$2,$3,$4)`, [row.projectId, tenantId, advRes.rows[0].id, JSON.stringify(row)]);
          return sendJson(res, 201, row);
        }

        const adProjectMatch = pathname.match(/^\/api\/ad\/projects\/([^/]+)$/);
        if (adProjectMatch && req.method === 'GET') {
          const id = decodeURIComponent(adProjectMatch[1]);
          const r = await pgPool.query(`SELECT id, data FROM ad_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          return r.rows[0] ? sendJson(res, 200, { ...(r.rows[0].data || {}), projectId: r.rows[0].id }) : sendJson(res, 404, { error: '광고 제작 프로젝트를 찾을 수 없습니다.' });
        }
        if (adProjectMatch && (req.method === 'PATCH' || req.method === 'PUT')) {
          const id = decodeURIComponent(adProjectMatch[1]);
          const patch = await readJson(req);
          const cur = await pgPool.query(`SELECT data FROM ad_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          const current = cur.rows[0]?.data;
          if (!current) return sendJson(res, 404, { error: '광고 제작 프로젝트를 찾을 수 없습니다.' });
          const updated = normalizeAdProject(patch, { ...current, projectId:id });
          if (!updated.advertiserId) return sendJson(res, 400, { error: '광고주를 선택하세요.' });
          const advRes = await pgPool.query(`SELECT id, name FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, updated.advertiserId]);
          if (!advRes.rows[0]) return sendJson(res, 400, { error: '선택한 광고주를 찾을 수 없습니다.' });
          updated.advertiserName = advRes.rows[0].name;
          await pgPool.query(`UPDATE ad_projects SET advertiser_id=$3, data=$4, updated_at=now() WHERE tenant_id=$1 AND id=$2`, [tenantId, id, advRes.rows[0].id, JSON.stringify(updated)]);
          return sendJson(res, 200, updated);
        }
        if (adProjectMatch && req.method === 'DELETE') {
          const id = decodeURIComponent(adProjectMatch[1]);
          await pgPool.query(`DELETE FROM ad_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          return sendJson(res, 200, { ok: true });
        }
      }

      if (pathname.startsWith('/api/templates')) {
        if (!requireDb(res)) return;
        const tenantId = await getCurrentTenantId();
        if (!tenantId) return sendJson(res, 409, { error: 'HOWTOM tenant를 찾을 수 없습니다.' });

        if (req.method === 'GET' && pathname === '/api/templates') {
          const r = await pgPool.query(`SELECT id, data FROM content_templates WHERE tenant_id=$1 ORDER BY updated_at DESC`, [tenantId]);
          return sendJson(res, 200, r.rows.map(row => ({ ...(row.data || {}), templateId: row.id })));
        }
        if (req.method === 'POST' && pathname === '/api/templates') {
          const body = await readJson(req);
          const row = normalizeTemplate(body);
          row.templateId = makeId('tpl');
          let advertiserUuid = null;
          if (row.advertiserId) {
            const advRes = await pgPool.query(`SELECT id, name FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, row.advertiserId]);
            if (!advRes.rows[0]) return sendJson(res, 400, { error: '선택한 광고주를 찾을 수 없습니다.' });
            advertiserUuid = advRes.rows[0].id; row.advertiserName = advRes.rows[0].name;
          }
          await pgPool.query(`INSERT INTO content_templates (id, tenant_id, advertiser_id, template_type, data) VALUES ($1,$2,$3,$4,$5)`, [row.templateId, tenantId, advertiserUuid, row.templateType, JSON.stringify(row)]);
          return sendJson(res, 201, row);
        }
        const templateMatch = pathname.match(/^\/api\/templates\/([^/]+)$/);
        if (templateMatch && (req.method === 'PATCH' || req.method === 'PUT')) {
          const id = decodeURIComponent(templateMatch[1]);
          const patch = await readJson(req);
          const cur = await pgPool.query(`SELECT data FROM content_templates WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          if (!cur.rows[0]?.data) return sendJson(res, 404, { error: '템플릿을 찾을 수 없습니다.' });
          const updated = normalizeTemplate(patch, { ...cur.rows[0].data, templateId: id });
          await pgPool.query(`UPDATE content_templates SET template_type=$3, data=$4, updated_at=now() WHERE tenant_id=$1 AND id=$2`, [tenantId, id, updated.templateType, JSON.stringify(updated)]);
          return sendJson(res, 200, updated);
        }
        if (templateMatch && req.method === 'DELETE') {
          const id = decodeURIComponent(templateMatch[1]);
          await pgPool.query(`DELETE FROM content_templates WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          return sendJson(res, 200, { ok: true });
        }
        // 템플릿 복제: 이름 뒤에 "복사본"을 붙여 새 템플릿으로 저장합니다.
        const duplicateMatch = pathname.match(/^\/api\/templates\/([^/]+)\/duplicate$/);
        if (duplicateMatch && req.method === 'POST') {
          const id = decodeURIComponent(duplicateMatch[1]);
          const cur = await pgPool.query(`SELECT data FROM content_templates WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          if (!cur.rows[0]?.data) return sendJson(res, 404, { error: '템플릿을 찾을 수 없습니다.' });
          const source = cur.rows[0].data;
          const row = normalizeTemplate({ ...source, name: `${source.name} 복사본`, useCount: 0, isFavorite: false }, null);
          row.templateId = makeId('tpl');
          const advertiserUuid = row.advertiserId ? (await pgPool.query(`SELECT id FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, row.advertiserId])).rows[0]?.id || null : null;
          await pgPool.query(`INSERT INTO content_templates (id, tenant_id, advertiser_id, template_type, data) VALUES ($1,$2,$3,$4,$5)`, [row.templateId, tenantId, advertiserUuid, row.templateType, JSON.stringify(row)]);
          return sendJson(res, 201, row);
        }
        // 새 버전 만들기: 같은 이름 계열로 버전 번호를 올려 새 템플릿으로 저장합니다.
        const versionMatch = pathname.match(/^\/api\/templates\/([^/]+)\/new-version$/);
        if (versionMatch && req.method === 'POST') {
          const id = decodeURIComponent(versionMatch[1]);
          const cur = await pgPool.query(`SELECT data FROM content_templates WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          if (!cur.rows[0]?.data) return sendJson(res, 404, { error: '템플릿을 찾을 수 없습니다.' });
          const source = cur.rows[0].data;
          const rootId = source.parentTemplateId || source.templateId;
          const related = await pgPool.query(`SELECT data FROM content_templates WHERE tenant_id=$1 AND (id=$2 OR data->>'parentTemplateId'=$2)`, [tenantId, rootId]);
          const maxVersion = Math.max(1, ...related.rows.map(r => Number(r.data?.version) || 1));
          const row = normalizeTemplate({ ...source, version: maxVersion + 1, parentTemplateId: rootId, useCount: 0 }, null);
          row.templateId = makeId('tpl');
          const advertiserUuid = row.advertiserId ? (await pgPool.query(`SELECT id FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, row.advertiserId])).rows[0]?.id || null : null;
          await pgPool.query(`INSERT INTO content_templates (id, tenant_id, advertiser_id, template_type, data) VALUES ($1,$2,$3,$4,$5)`, [row.templateId, tenantId, advertiserUuid, row.templateType, JSON.stringify(row)]);
          return sendJson(res, 201, row);
        }
      }

      if (pathname.startsWith('/api/documents')) {
        if (!requireDb(res)) return;
        const tenantId = await getCurrentTenantId();
        if (!tenantId) return sendJson(res, 409, { error: 'HOWTOM tenant를 찾을 수 없습니다.' });

        if (req.method === 'GET' && pathname === '/api/documents') {
          const r = await pgPool.query(`SELECT id, data FROM document_projects WHERE tenant_id=$1 ORDER BY updated_at DESC`, [tenantId]);
          return sendJson(res, 200, r.rows.map(row => ({ ...(row.data || {}), projectId: row.id })));
        }
        if (req.method === 'POST' && pathname === '/api/documents') {
          const body = await readJson(req);
          const row = normalizeDocumentProject(body);
          row.projectId = makeId('doc');
          if (!row.advertiserId) return sendJson(res, 400, { error: '광고주를 선택하세요.' });
          const advRes = await pgPool.query(`SELECT id, name FROM advertisers WHERE tenant_id=$1 AND id::text=$2`, [tenantId, row.advertiserId]);
          if (!advRes.rows[0]) return sendJson(res, 400, { error: '선택한 광고주를 찾을 수 없습니다.' });
          row.advertiserName = advRes.rows[0].name;
          await pgPool.query(`INSERT INTO document_projects (id, tenant_id, advertiser_id, data) VALUES ($1,$2,$3,$4)`, [row.projectId, tenantId, advRes.rows[0].id, JSON.stringify(row)]);
          return sendJson(res, 201, row);
        }
        const docMatch = pathname.match(/^\/api\/documents\/([^/]+)$/);
        if (docMatch && req.method === 'GET') {
          const id = decodeURIComponent(docMatch[1]);
          const r = await pgPool.query(`SELECT id, data FROM document_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          return r.rows[0] ? sendJson(res, 200, { ...(r.rows[0].data || {}), projectId: r.rows[0].id }) : sendJson(res, 404, { error: '문서를 찾을 수 없습니다.' });
        }
        if (docMatch && (req.method === 'PATCH' || req.method === 'PUT')) {
          const id = decodeURIComponent(docMatch[1]);
          const patch = await readJson(req);
          const cur = await pgPool.query(`SELECT data FROM document_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          const current = cur.rows[0]?.data;
          if (!current) return sendJson(res, 404, { error: '문서를 찾을 수 없습니다.' });
          const updated = normalizeDocumentProject(patch, { ...current, projectId: id });
          await pgPool.query(`UPDATE document_projects SET data=$3, updated_at=now() WHERE tenant_id=$1 AND id=$2`, [tenantId, id, JSON.stringify(updated)]);
          return sendJson(res, 200, updated);
        }
        if (docMatch && req.method === 'DELETE') {
          const id = decodeURIComponent(docMatch[1]);
          await pgPool.query(`DELETE FROM document_projects WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
          return sendJson(res, 200, { ok: true });
        }
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
        if (req.method === 'POST' && pathname === '/api/blog/generate') return sendJson(res, 409, { error: 'AI 원고 생성은 제휴 업체 API가 확정된 뒤 연결합니다. 현재는 직접 작성·편집 기능을 사용하세요.' });

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

server.listen(PORT, '0.0.0.0', () => console.log(`[HOWTOM Content Studio] PHASE 2B blog+ad server listening on :${PORT}`));
process.on('SIGTERM', async () => { try { await pgPool?.end(); } catch {} server.close(() => process.exit(0)); });
