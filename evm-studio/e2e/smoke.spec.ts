import { test, expect } from '@playwright/test'

test('サーバーヘルスチェック', async ({ request }) => {
  const response = await request.get('http://localhost:3001/health')
  expect(response.ok()).toBeTruthy()
  const body = await response.json()
  expect(body.status).toBe('ok')
})

test('トップページが表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('EVM Studio')).toBeVisible()
})
