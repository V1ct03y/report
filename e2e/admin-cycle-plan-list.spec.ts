import { expect, Page, test } from '@playwright/test'

const ADMIN_USER = 'kwok-admin'
const ADMIN_PASS = 'ChangeMe123!'

async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.locator('input[type="text"]').fill(ADMIN_USER)
  await page.locator('input[type="password"]').fill(ADMIN_PASS)
  await page.getByRole('button').click()
  await page.waitForURL('/admin/dashboard', { timeout: 10000 })
  await page.waitForSelector('.page-grid', { timeout: 10000 })
}

test.describe('管理员周期计划列表', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('后台只保留控制中心和周期列表，不再显示旧调度或结果预览区', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '周期控制中心' }).first()).toBeVisible()
    await expect(page.getByText('周期列表')).toBeVisible()
    await expect(page.getByText('自动调度配置')).toHaveCount(0)
    await expect(page.getByText('结果预览')).toHaveCount(0)
  })

  test('周期列表成为主操作区，未来周期直接提供调整和删除按钮', async ({ page }) => {
    const plannedCycle = page.locator('.cycle-item').filter({ hasText: '待开始' }).first()
    await expect(plannedCycle).toBeVisible()
    await expect(plannedCycle.getByRole('button', { name: '调整时间' })).toBeVisible()
    await expect(plannedCycle.getByRole('button', { name: '删除' })).toBeVisible()
  })

  test('当前计划中至少有一个可直接结算的入口', async ({ page }) => {
    await expect(page.getByRole('button', { name: /手动结算|执行结算/ }).first()).toBeVisible()
  })
})
