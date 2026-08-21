import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:4399/gone/',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --port 4399',
    cwd: process.cwd(),
    url: 'http://127.0.0.1:4399/gone/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
