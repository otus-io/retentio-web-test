import { defineConfig, devices } from '@playwright/test'
import { loadE2EEnv } from './e2e/load-env'

loadE2EEnv()

const isCI = !!process.env.CI
const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || (isCI ? 'http://localhost:3000' : 'http://localhost:5173')
const hasE2EAuth = !!(process.env.E2E_USERNAME && process.env.E2E_PASSWORD)
const authStatePath = 'e2e/.auth-state.json'
const apiURL =
  (process.env.E2E_API_URL || process.env.VITE_API_URL || 'https://api.retentio.app:8443').replace(
    /\/$/,
    '',
  )

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // Shared E2E account — avoid parallel mutations of the same user data.
  workers: 1,
  reporter: isCI
    ? [['github'], ['list']]
    : [['html', { open: 'never' }], ['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    ...(hasE2EAuth ? { storageState: authStatePath } : {}),
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: isCI ? 'npm run start' : 'npm run dev:release',
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_API_URL: apiURL,
      PORT: isCI ? '3000' : process.env.PORT ?? '',
    },
  },
})
