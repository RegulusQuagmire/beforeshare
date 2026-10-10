import { defineConfig, devices } from '@playwright/test'
import { deploymentBase } from './vite.config.ts'

const previewURL = 'http://127.0.0.1:4183' + (process.env.VITE_BASE_PATH ?? deploymentBase(process.env.GITHUB_REPOSITORY))

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: previewURL,
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], launchOptions: { executablePath: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH } }, testMatch: /(?:journey|objects)\.spec\.ts/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testMatch: /(?:journey|objects)\.spec\.ts/ },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4183 --strictPort',
    url: previewURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
