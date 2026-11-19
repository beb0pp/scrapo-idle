import { defineConfig } from '@playwright/test';

/** Own port so it never collides with the main checkout's dev or e2e servers. */
const PORT = Number(process.env.FERRO_E2E_PORT ?? 5197);

export default defineConfig({
  testDir: 'e2e/ferromancia',
  workers: 1,
  timeout: 60_000,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
