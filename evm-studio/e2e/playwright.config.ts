import { defineConfig, devices } from '@playwright/test'
import { execSync } from 'child_process'

// クライアントサーバーがすでに起動しているかを ss コマンドで確認する
// ss は即座に結果を返すため、nc のようにハングしない
function isPortListening(port: number): boolean {
  try {
    const result = execSync(`ss -tlnp 2>/dev/null`, { stdio: 'pipe' }).toString()
    return result.includes(`:${port} `) || result.includes(`:${port}\t`)
  } catch {
    return false
  }
}

const clientIsRunning = isPortListening(5173)

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  use: {
    // クライアントが起動していない場合は baseURL を設定しない
    // (UI テストはスキップ、API テストは絶対 URL を使用)
    ...(clientIsRunning ? { baseURL: 'http://localhost:5173' } : {}),
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
    // クライアントが起動している場合のみ webServer として登録する
    ...(clientIsRunning
      ? [
          {
            command: 'npm --prefix ../client run dev',
            port: 5173,
            reuseExistingServer: true,
          },
        ]
      : []),
  ],
})
