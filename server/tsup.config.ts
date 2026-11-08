import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  // Bundle the shared workspace package (it is shipped as TypeScript source).
  noExternal: ['@gp/shared'],
  // Keep the "node:" prefix: node:sqlite only exists with it.
  removeNodeProtocol: false,
});
