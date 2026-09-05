import { build } from 'esbuild';
await build({
  entryPoints: ['src/skydex-brand.tsx'],
  outfile: 'public/skydex-brand.js',
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'linked',
});
