import { defineConfig, devices } from '@playwright/test'

// Smoke tests against a running Django server that serves the built frontend:
//   cd frontend && npm run build && (cd .. && uv run python manage.py runserver 8765) & npm run test:e2e
// Uses the Chrome already installed on the machine (channel: 'chrome'), so no browser download is needed.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8765',
    channel: 'chrome',
    launchOptions: { args: ['--use-angle=metal'] },
  },
  projects: [
    { name: 'phone', use: { ...devices['iPhone 15'], channel: 'chrome', browserName: 'chromium' } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
  ],
})
