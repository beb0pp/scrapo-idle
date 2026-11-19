import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e/ferromancia',
  workers: 1,
  timeout: 60_000,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5192',
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'npx vite --port 5192 --strictPort',
    url: 'http://localhost:5192',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
