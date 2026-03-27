import { test, expect, Page } from '@playwright/test'

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

test.describe('管理员周期控制台', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('页面显示周期控制中心、调度配置和周期列表', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '周期控制中心' }).first()).toBeVisible()
    await expect(page.getByText('自动调度配置')).toBeVisible()
    await expect(page.getByText('周期列表')).toBeVisible()
  })

  test('控制中心会显示一个明确的下一步动作', async ({ page }) => {
    const actionButton = page.getByRole('button').filter({
      hasText: /手动结算|执行结算|确认公示|归档公示|同步周期状态/
    }).first()
    await expect(actionButton).toBeVisible()
  })

  test('调度开关、时间选择器和保存按钮可见', async ({ page }) => {
    await expect(page.locator('.schedule-toggle input')).toBeVisible()
    await expect(page.locator('.schedule-select')).toHaveCount(2)
    await expect(page.getByRole('button', { name: '保存调度配置' })).toBeVisible()
  })

  test('下次事件时间会展示', async ({ page }) => {
    await expect(page.locator('.schedule-next')).toBeVisible()
    await expect(page.locator('.schedule-next')).toContainText('开周期')
    await expect(page.locator('.schedule-next')).toContainText('结算')
  })

  test('可以修改调度设置并保存', async ({ page }) => {
    await page.locator('.schedule-select').first().selectOption('4')
    await page.getByRole('button', { name: '保存调度配置' }).click()
    await expect(page.getByRole('button', { name: '保存调度配置' })).toBeEnabled()
  })

  test('周期列表会展示已有周期和新增表单', async ({ page }) => {
    await expect(page.locator('.cycle-item').first()).toBeVisible()
    await expect(page.getByPlaceholder('周期名称（可选）')).toBeVisible()
    await expect(page.getByRole('button', { name: '新增周期' })).toBeVisible()
  })

  test('draft 周期可以调整时间和删除', async ({ page }) => {
    const draftCycle = page.locator('.cycle-item').filter({ hasText: '待开始' }).first()
    if (!(await draftCycle.isVisible().catch(() => false))) {
      test.skip()
    }

    await expect(draftCycle.getByRole('button', { name: '调整时间' })).toBeVisible()
    await expect(draftCycle.getByRole('button', { name: '删除' })).toBeVisible()
  })

  test('手动创建周期不会隐藏调度配置', async ({ page }) => {
    const nameInput = page.getByPlaceholder('周期名称（可选）')
    await nameInput.fill('测试周期')

    const dateInputs = page.locator('.cycle-create input[type="datetime-local"]')
    await dateInputs.first().fill('2026-09-01T20:00')
    await dateInputs.nth(1).fill('2026-09-03T20:00')
    await page.getByRole('button', { name: '新增周期' }).click()
    await page.waitForTimeout(1200)

    await expect(page.getByText('自动调度配置')).toBeVisible()
    await expect(page.locator('.schedule-toggle input')).toBeVisible()
  })
})
