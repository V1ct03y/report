import { expect, Page, test } from '@playwright/test'

const ADMIN_USER = 'kwok-admin'
const DEFAULT_PASS = 'ChangeMe123!'

async function login(page: Page, username: string, password: string) {
  await page.goto('/login')
  await page.waitForSelector('input[type="text"]', { timeout: 10000 })
  await page.locator('input[type="text"]').fill(username)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button').click()

  await page.waitForURL((url) => !url.href.includes('/login'), { timeout: 10000 })

  if (page.url().includes('/reset-password')) {
    const pwdInputs = page.locator('input[type="password"]')
    if (await pwdInputs.count() >= 3) {
      await pwdInputs.nth(0).fill(password)
      await pwdInputs.nth(1).fill(password)
      await pwdInputs.nth(2).fill(password)
      await page.locator('.reset-view .primary-button').click()
      await page.waitForURL((url) => !url.href.includes('/reset-password'), { timeout: 10000 }).catch(() => {})
    }
  }

  await page.waitForSelector('.page-grid', { timeout: 10000 })
}

test('管理员结算后还需要额外确认公示', async ({ browser }) => {
  const adminPage = await browser.newPage()
  await login(adminPage, ADMIN_USER, DEFAULT_PASS)

  const settleButton = adminPage.getByRole('button', { name: /手动结算|执行结算/ }).first()
  if (await settleButton.isVisible().catch(() => false)) {
    await settleButton.click()
    await adminPage.waitForTimeout(1500)
  }

  const publishButton = adminPage.getByRole('button', { name: '确认公示' }).first()
  await expect(publishButton).toBeVisible({ timeout: 10000 })

  await publishButton.click()
  await adminPage.waitForTimeout(1500)
  await expect(adminPage.getByRole('button', { name: '确认公示' })).toHaveCount(0)
  await expect(
    adminPage.getByRole('button', { name: /归档|手动同步|手动结算|执行结算/ }).first()
  ).toBeVisible()
  await adminPage.close()
})
