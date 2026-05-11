import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  use: {
    baseURL: 'http://localhost:5173',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm --prefix ../server run dev',
      port: 3001,
      reuseExistingServer: true,
    },
    {
      command: 'npm --prefix ../client run dev',
      port: 5173,
      reuseExistingServer: true,
    },
  ],
})
