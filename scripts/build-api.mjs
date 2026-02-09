import { build } from 'esbuild';
import { readdirSync, mkdirSync } from 'fs';

// Bundle each api-src/*.ts entry point into api/*.js as self-contained
// serverless functions. Source lives in api-src/ (not api/) so Vercel
// doesn't try to compile them with its own builder.
const apiFiles = readdirSync('api-src')
  .filter(f => f.endsWith('.ts') && f !== 'db-serverless.ts')
  .map(f => `api-src/${f}`);

mkdirSync('api', { recursive: true });

console.log('Bundling API functions:', apiFiles);

await build({
  entryPoints: apiFiles,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outdir: 'api',
  outExtension: { '.js': '.js' },
  external: ['@vercel/node'],
  sourcemap: false,
  minify: false,
});

console.log('API functions bundled successfully');
