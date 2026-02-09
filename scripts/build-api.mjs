import { build } from 'esbuild';
import { readdirSync } from 'fs';

// Bundle each api/*.ts entry point into api/*.js as self-contained serverless functions.
// This is needed because Vercel's @vercel/node builder doesn't properly handle
// cross-directory imports in ESM ("type": "module") projects.
// Vercel prefers .js over .ts when both exist with the same name.
const apiFiles = readdirSync('api')
  .filter(f => f.endsWith('.ts') && f !== 'db-serverless.ts')
  .map(f => `api/${f}`);

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
