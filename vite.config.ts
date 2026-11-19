import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  server: { port: 5180, strictPort: true, watch: { ignored: ['**/.snapshots/**', '**/assets-src/**'] } },
  preview: { port: 5181, strictPort: true },
  build: { chunkSizeWarningLimit: 2000 },
  test: { exclude: ['**/node_modules/**', '.snapshots/**'] },
});
