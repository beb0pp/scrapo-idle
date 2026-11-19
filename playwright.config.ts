import { defineConfig } from '@playwright/test';

// Runs against the Vite dev server (the __scrapo debug hooks only exist in dev) with the installed Chrome.
export default defineConfig({
  testDir: 'e2e',
  testIgnore: ['ferromancia/**'],
  timeout: 120_000,
  workers: 1,
  reporter: [['list']],
  outputDir: '.snapshots/e2e-results',
  use: {
    baseURL: 'http://localhost:5190',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1366, height: 860 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx vite --port 5190 --strictPort',
    url: 'http://localhost:5190',
    env: { SCRAPO_E2E: '1' },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
