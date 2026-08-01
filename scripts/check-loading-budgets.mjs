import { access, readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const publicAssetsRoot = join(projectRoot, 'public', 'assets');
const distRoot = join(projectRoot, 'dist');
const runtimeBudgetBytes = 20 * 1024 * 1024;
const firstScreenBudgetBytes = 8 * 1024 * 1024;
const firstScreenAssets = [
  'assets/backgrounds/title.webp',
  'assets/fonts/fusion-pixel-12px-proportional-zh_hans.otf.woff2',
  'assets/sprites/iya-atlas.png',
  'assets/sprites/iya-portrait.png',
  'assets/sprites/crawler.png',
  'assets/sprites/crawler-shielded.png',
  'assets/sprites/crawler-exposed.png',
  'assets/sprites/sentry.png',
  'assets/sprites/turret.png',
  'assets/ui/base-icons.png',
];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
}

async function totalSize(files) {
  const stats = await Promise.all(files.map((file) => stat(file)));
  return stats.reduce((total, fileStat) => total + fileStat.size, 0);
}

await access(distRoot);

const runtimeFiles = await walk(publicAssetsRoot);
const runtimeBytes = await totalSize(runtimeFiles);
if (runtimeBytes > runtimeBudgetBytes) {
  throw new Error(`运行时资源 ${(runtimeBytes / 1024 / 1024).toFixed(2)}MB 超过 20MB 预算`);
}

const distFiles = await walk(distRoot);
const shellFiles = distFiles.filter((file) =>
  ['.html', '.js', '.css'].includes(extname(file).toLowerCase()),
);
const firstScreenFiles = [
  ...shellFiles,
  ...firstScreenAssets.map((asset) => join(distRoot, asset)),
];
for (const file of firstScreenFiles) await access(file);
const firstScreenBytes = await totalSize(firstScreenFiles);
if (firstScreenBytes > firstScreenBudgetBytes) {
  throw new Error(`首屏 ${(firstScreenBytes / 1024 / 1024).toFixed(2)}MB 超过 8MB 预算`);
}

for (const file of shellFiles.filter((candidate) => extname(candidate) === '.js')) {
  const source = await readFile(file, 'utf8');
  if (source.includes('__STAR_ECHO_TEST__')) {
    throw new Error(`生产包泄露测试接口：${relative(distRoot, file)}`);
  }
}

console.log(
  `Loading budgets passed: runtime ${(runtimeBytes / 1024 / 1024).toFixed(2)}MB / 20MB, ` +
    `first screen ${(firstScreenBytes / 1024 / 1024).toFixed(2)}MB / 8MB.`,
);
