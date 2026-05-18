import { test, expect } from '@playwright/test'

test('サーバーヘルスチェック', async ({ request }) => {
  const response = await request.get('http://localhost:3001/health')
  expect(response.ok()).toBeTruthy()
  const body = await response.json()
  expect(body.status).toBe('ok')
})

test('トップページが表示される', async ({ page }) => {
  await page.goto('/')
  // TopBar には BrandMark の <span aria-label="Prime Brains"> と
  // wordmark の <div> の 2 箇所に "EVM STUDIO" が並ぶ。
  // strict mode 違反を避けるため .first() で先頭の 1 件に限定する。
  await expect(page.getByText('EVM Studio').first()).toBeVisible()
})
