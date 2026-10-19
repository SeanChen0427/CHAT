// Sean 版（Supabase）：把 src/ 打包成單一檔案，部署為 Supabase Edge Function「api」。
// 第三方套件不打包，由 Deno 依 deno.json 的 import map 以 npm: 規格載入（版本與 package.json 鎖定一致），
// 讓上傳的程式碼只有自己的部分、檔案小。
import { build } from 'esbuild';
import { format } from 'prettier';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';

const outdir = 'supabase/functions/api';
mkdirSync(outdir, { recursive: true });

const PKGS = ['hono', 'drizzle-orm', 'chinese-simple2traditional', 'postgres'];
const version = (p) => JSON.parse(readFileSync(`node_modules/${p}/package.json`, 'utf8')).version;

// 直接改寫成 npm: 規格（例：hono/cors → npm:hono@4.12.32/cors），打包檔不依賴 import map，
// 單一檔案即可部署（也能直接貼到 Supabase 後台的線上編輯器）。
const npmSpecifier = {
  name: 'npm-specifier',
  setup(b) {
    b.onResolve({ filter: new RegExp(`^(${PKGS.join('|')})(/.*)?$`) }, (args) => {
      const [, pkg, sub = ''] = args.path.match(new RegExp(`^(${PKGS.join('|')})(/.*)?$`));
      return { path: `npm:${pkg}@${version(pkg)}${sub}`, external: true };
    });
  },
};

await build({
  entryPoints: ['src/supabase-entry.ts'],
  outfile: `${outdir}/index.ts`,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  plugins: [npmSpecifier],
  minify: true,
  charset: 'utf8',
  banner: { js: '// @ts-nocheck\n// 由 scripts/build-function.mjs 產生，請勿手動修改；原始碼在 src/。' },
  legalComments: 'none',
  logLevel: 'info',
});

// 壓縮後再排版成多行：檔案小、又能在 Supabase 後台逐行檢視。
const out = `${outdir}/index.ts`;
const code = readFileSync(out, 'utf8');
const banner = '// @ts-nocheck\n// 由 scripts/build-function.mjs 產生，請勿手動修改；原始碼在 src/。\n';
const pretty = await format(code, { parser: 'babel', printWidth: 160, useTabs: true });
writeFileSync(out, banner + pretty.replace(/^\/\/ @ts-nocheck\n\/\/ [^\n]*\n/, ''));

writeFileSync(`${outdir}/deno.json`, JSON.stringify({ imports: {} }, null, 2) + '\n');
