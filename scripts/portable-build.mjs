import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');
const outSrcDir = path.join(distDir, 'src');
const require = createRequire(import.meta.url);
const tsPath = path.join(rootDir, 'node_modules', 'typescript', 'lib', 'typescript.js');
if (!existsSync(tsPath)) throw new Error('TypeScript runtime을 찾지 못했습니다. npm ci 후 다시 실행하세요.');
const ts = require(tsPath);

const universeUrl = process.env.VITE_UNIVERSE_URL || 'https://universe.howtom.example.com';
const importMap = { imports: {
  react: 'https://esm.sh/react@18.3.1',
  'react/': 'https://esm.sh/react@18.3.1/',
  'react-dom': 'https://esm.sh/react-dom@18.3.1?external=react',
  'react-dom/client': 'https://esm.sh/react-dom@18.3.1/client?external=react',
  'react-router-dom': 'https://esm.sh/react-router-dom@6.26.2?external=react,react-dom',
} };

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function sourceResolution(fromFile, spec) {
  if (!spec.startsWith('.')) return spec;
  if (/\.(js|mjs|json|css|png|jpg|jpeg|svg|webp)$/i.test(spec)) return spec;
  const abs = path.resolve(path.dirname(fromFile), spec);
  const variants = [
    [abs + '.ts', spec + '.js'],
    [abs + '.tsx', spec + '.js'],
    [path.join(abs, 'index.ts'), spec.replace(/\/$/, '') + '/index.js'],
    [path.join(abs, 'index.tsx'), spec.replace(/\/$/, '') + '/index.js'],
  ];
  for (const [candidate, replacement] of variants) if (existsSync(candidate)) return replacement;
  return spec;
}

function rewriteImports(js, sourceFile) {
  const rewrite = (_full, prefix, spec, suffix) => `${prefix}${sourceResolution(sourceFile, spec)}${suffix}`;
  js = js.replace(/(from\s*["'])(\.[^"']+)(["'])/g, rewrite);
  js = js.replace(/(import\s*\(\s*["'])(\.[^"']+)(["']\s*\))/g, rewrite);
  js = js.replace(/(import\s*["'])(\.[^"']+)(["'])/g, rewrite);
  return js;
}

rmSync(distDir, { recursive: true, force: true });
mkdirSync(outSrcDir, { recursive: true });
let modules = 0;

for (const input of walk(srcDir)) {
  if (input.endsWith('.d.ts')) continue;
  const rel = path.relative(srcDir, input);
  const ext = path.extname(input).toLowerCase();
  const target = path.join(outSrcDir, rel);
  mkdirSync(path.dirname(target), { recursive: true });

  if (ext === '.ts' || ext === '.tsx') {
    const source = readFileSync(input, 'utf8');
    const result = ts.transpileModule(source, {
      fileName: input,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        jsx: ts.JsxEmit.ReactJSX,
        useDefineForClassFields: true,
        isolatedModules: true,
      },
      reportDiagnostics: true,
    });
    const errors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
    if (errors.length) throw new Error(`${rel}: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`);
    let out = result.outputText.replace(/^\s*import\s+['"][^'"]+\.css['"]\s*;?\s*$/gm, '');
    out = rewriteImports(out, input);
    out = out.replace(/import\.meta\.env\.VITE_UNIVERSE_URL/g, JSON.stringify(universeUrl));
    writeFileSync(target.replace(/\.tsx?$/i, '.js'), out, 'utf8');
    modules += 1;
  } else if (ext === '.css') {
    copyFileSync(input, target);
  }
}

const html = `<!doctype html><html lang="ko"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><meta name="color-scheme" content="light"/><title>HOWTOM 콘텐츠 제작소</title><link rel="stylesheet" href="/src/design/tokens.css"/><script type="importmap">${JSON.stringify(importMap)}</script></head><body><div id="root"></div><script type="module" src="/src/main.js"></script></body></html>`;
writeFileSync(path.join(distDir, 'index.html'), html, 'utf8');
writeFileSync(path.join(distDir, 'BUILD_INFO.json'), JSON.stringify({
  builder: 'portable-esm',
  phase: 1,
  builtAt: new Date().toISOString(),
  modules,
  note: 'OS별 Rollup optional dependency가 없는 검증 환경용 fallback build',
}, null, 2));
console.log(`[완료] Content Studio PHASE 2B portable build: ${modules}개 TS/TSX → dist`);
