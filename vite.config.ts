import { defineConfig } from 'vitest/config';

// E2E runs its own server without HMR so edits made during a run do not reload the page under test.
const e2e = !!process.env.SCRAPO_E2E;

export default defineConfig({
  base: './',
  server: { port: 5180, strictPort: true, hmr: !e2e, watch: e2e ? null : { ignored: ['**/.snapshots/**', '**/assets-src/**'] } },
  preview: { port: 5181, strictPort: true },
  build: { chunkSizeWarningLimit: 2000 },
  test: { exclude: ['**/node_modules/**', '.snapshots/**', 'e2e/**'] },
});
