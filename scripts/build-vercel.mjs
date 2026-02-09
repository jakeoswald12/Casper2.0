import { build } from 'esbuild';
import { execSync } from 'child_process';
import { mkdirSync, cpSync, writeFileSync, rmSync } from 'fs';

const OUTPUT = '.vercel/output';

// Step 1: Build client with Vite
console.log('Step 1: Building client...');
execSync('pnpm build:client', { stdio: 'inherit' });

// Step 2: Prepare output directory
rmSync(OUTPUT, { recursive: true, force: true });
mkdirSync(`${OUTPUT}/static`, { recursive: true });

// Step 3: Copy Vite output to static
console.log('Step 2: Copying static files...');
cpSync('dist/client', `${OUTPUT}/static`, { recursive: true });

// Step 4: Bundle each API function with esbuild as self-contained CJS
const FUNCTIONS = [
  { name: 'trpc', maxDuration: 60 },
  { name: 'health', maxDuration: 30 },
  { name: 'webhooks', maxDuration: 30 },
];

console.log('Step 3: Bundling API functions...');
for (const fn of FUNCTIONS) {
  const funcDir = `${OUTPUT}/functions/api/${fn.name}.func`;
  mkdirSync(funcDir, { recursive: true });

  await build({
    entryPoints: [`api/${fn.name}.ts`],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: `${funcDir}/index.js`,
    sourcemap: false,
    minify: false,
    tsconfig: './tsconfig.json',
  });

  writeFileSync(
    `${funcDir}/.vc-config.json`,
    JSON.stringify(
      {
        runtime: 'nodejs20.x',
        handler: 'index.js',
        launcherType: 'Nodejs',
        maxDuration: fn.maxDuration,
      },
      null,
      2
    )
  );

  console.log(`  Bundled api/${fn.name}.ts`);
}

// Step 5: Write Vercel Build Output API config
console.log('Step 4: Writing route config...');
writeFileSync(
  `${OUTPUT}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '/api/trpc/(.*)', dest: '/api/trpc' },
        { src: '/api/webhooks/(.*)', dest: '/api/webhooks' },
        { src: '/api/health', dest: '/api/health' },
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    null,
    2
  )
);

console.log('Build complete!');
