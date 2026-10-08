import { spawnSync } from 'node:child_process';

const vite = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  encoding: 'utf8',
  stdio: 'pipe',
});

if (vite.status === 0) {
  process.stdout.write(vite.stdout || '');
  process.stderr.write(vite.stderr || '');
  process.exit(0);
}

const combined = `${vite.stdout || ''}\n${vite.stderr || ''}`;
const nativeRollupMissing = /Cannot find module ['"]?@rollup\/rollup-|optional dependencies/i.test(combined);

if (!nativeRollupMissing) {
  process.stdout.write(vite.stdout || '');
  process.stderr.write(vite.stderr || '');
  process.exit(vite.status || 1);
}

console.warn('[안내] 현재 OS용 Rollup optional dependency가 없어 portable ESM build로 검증합니다.');
const fallback = spawnSync(process.execPath, ['scripts/portable-build.mjs'], { stdio: 'inherit' });
// P1: signal로 종료된 경우(fallback.status === null)는 0이 아닌 1로 종료합니다.
if (fallback.status === null) process.exit(1);
process.exit(fallback.status);
