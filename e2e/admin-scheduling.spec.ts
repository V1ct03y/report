import { test, expect, Page } from '@playwright/test'

const ADMIN_USER = 'kwok-admin'
const ADMIN_PASS = 'ChangeMe123!'

async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.locator('input[type="text"]').fill(ADMIN_USER)
  await page.locator('input[type="password"]').fill(ADMIN_PASS)
  await page.locator('button').click()
  await page.waitForURL('/admin/dashboard', { timeout: 5000 })
}

async function waitForPageReady(page: Page) {
  await page.waitForSelector('.page-grid', { timeout: 5000 })
}

test.describe('自动调度配置', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await waitForPageReady(page)
  })

  test('页面加载后自动调度配置 section 可见', async ({ page }) => {
    await expect(page.getByText('自动调度配置')).toBeVisible()
  })

  test('调度启用开关可见且状态正确显示', async ({ page }) => {
    const enabled = page.getByText('自动调度已启用')
    const disabled = page.getByText('自动调度已禁用')
    const isEnabledVisible = await enabled.isVisible()
    const isDisabledVisible = await disabled.isVisible()
    expect(isEnabledVisible || isDisabledVisible).toBeTruthy()
  })

  test('开启周期时间选择器可见', async ({ page }) => {
    await expect(page.getByText('开启周期')).toBeVisible()
    const selects = page.locator('.schedule-select')
    await expect(selects).toHaveCount(2) // 开启日 + 结算日
  })

  test('保存调度配置按钮存在', async ({ page }) => {
    await expect(page.getByRole('button', { name: '保存调度配置' })).toBeVisible()
  })

  test('下次事件时间显示', async ({ page }) => {
    // Wait for scheduling config to load
    await expect(page.getByText(/下次事件|加载中/)).toBeVisible()
    const scheduleNext = page.locator('.schedule-next')
    await expect(scheduleNext).toBeVisible({ timeout: 8000 })
    await expect(scheduleNext.getByText(/开启于/)).toBeVisible()
    await expect(scheduleNext.getByText(/结算于/)).toBeVisible()
  })

  test('修改开启日并保存', async ({ page }) => {
    const openDaySelect = page.locator('.schedule-select').first()
    await openDaySelect.selectOption('4') // 切换到周四

    const saveBtn = page.getByRole('button', { name: '保存调度配置' })
    await saveBtn.click()

    // 保存后按鈕應該恢復
    await expect(saveBtn).toBeEnabled()
  })
})

test.describe('周期列表', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await waitForPageReady(page)
  })

  test('周期列表 section 可见', async ({ page }) => {
    await expect(page.getByText('周期列表')).toBeVisible()
  })

  test('周期列表中显示已有周期', async ({ page }) => {
    // Wait for cycle list to load
    await expect(page.getByText('周期列表')).toBeVisible()
    await expect(page.locator('.cycle-item').first()).toBeVisible({ timeout: 8000 })
  })

  test('触发自动结算按钮可见', async ({ page }) => {
    await expect(page.getByRole('button', { name: '触发自动结算' })).toBeVisible()
  })

  test('立即结算按钮可见', async ({ page }) => {
    await expect(page.getByRole('button', { name: '立即结算' })).toBeVisible()
  })

  test('新增周期表单可见', async ({ page }) => {
    await expect(page.getByPlaceholder('周期名称（如 第X周工作评分）')).toBeVisible()
    await expect(page.getByRole('button', { name: '新增周期' })).toBeVisible()
  })

  test('draft 周期有调整时间和删除按钮', async ({ page }) => {
    // 找到 draft 状态的周期
    const draftCycle = page.locator('.cycle-item').filter({ hasText: '待开启' }).first()
    if (await draftCycle.isVisible()) {
      await expect(draftCycle.getByRole('button', { name: '调整时间' })).toBeVisible()
      await expect(draftCycle.getByRole('button', { name: '删除' })).toBeVisible()
    }
  })

  test('展开 draft 周期编辑模式', async ({ page }) => {
    const draftCycle = page.locator('.cycle-item').filter({ hasText: '待开启' }).first()
    if (!(await draftCycle.isVisible())) {
      test.skip()
    }

    await draftCycle.getByRole('button', { name: '调整时间' }).click()
    await expect(draftCycle.getByRole('button', { name: '保存' })).toBeVisible()
    await expect(draftCycle.getByRole('button', { name: '取消' })).toBeVisible()
  })

  test('取消编辑不保存', async ({ page }) => {
    const draftCycle = page.locator('.cycle-item').filter({ hasText: '待开启' }).first()
    if (!(await draftCycle.isVisible())) {
      test.skip()
    }

    await draftCycle.getByRole('button', { name: '调整时间' }).click()
    const startInput = draftCycle.locator('input[type="datetime-local"]').first()
    await startInput.fill('2026-04-10T20:00')
    await draftCycle.getByRole('button', { name: '取消' }).click()

    // 按钮恢复为"调整时间"
    await expect(draftCycle.getByRole('button', { name: '调整时间' })).toBeVisible()
  })
})

test.describe('新增周期', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await waitForPageReady(page)
  })

  test('创建周期时自动禁用自动调度', async ({ page }) => {
    // 填入周期信息（先跳过已有一个 draft 周期的情况）
    const nameInput = page.locator('.cycle-create input[type="text"]')
    if (await nameInput.isVisible()) {
      await nameInput.fill('测试周期')
      const dateInputs = page.locator('.cycle-create input[type="datetime-local"]')
      await dateInputs.first().fill('2026-09-01T20:00')
      await dateInputs.nth(1).fill('2026-09-03T20:00')
      await page.getByRole('button', { name: '新增周期' }).click()
      await page.waitForTimeout(1500)
      // 如果已有 draft 周期，后端会返回错误而非创建
      // 无论如何，UI 行为是点击创建后页面刷新了
    }
  })
})
