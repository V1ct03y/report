import { expect, Page, test } from '@playwright/test'

const ADMIN_USER = 'kwok-admin'
const LEADER_USER = 'leader-a'
const MEMBER_USER = 'zhangsan'
const DEFAULT_PASS = 'ChangeMe123!'

async function login(page: Page, username: string, password: string) {
  await page.goto('/login')
  await page.waitForSelector('input[type="text"]', { timeout: 10000 })
  await page.locator('input[type="text"]').fill(username)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button').click()

  await page.waitForURL((url) => !url.href.includes('/login'), { timeout: 10000 })

  if (page.url().includes('/reset-password')) {
    await page.waitForSelector('.reset-view', { timeout: 10000 })
    const pwdInputs = page.locator('input[type="password"]')
    if (await pwdInputs.count() >= 3) {
      await pwdInputs.nth(0).fill(password)
      await pwdInputs.nth(1).fill(password)
      await pwdInputs.nth(2).fill(password)
      await page.locator('.reset-view .primary-button').click()
      await page.waitForURL((url) => !url.href.includes('/reset-password'), { timeout: 10000 }).catch(() => {})
    }
  }

  await page.waitForURL((url) => !url.href.includes('/login') && !url.href.includes('/reset-password'), { timeout: 10000 })
  await page.waitForSelector('.page-grid', { timeout: 10000 })
}

test.describe('成员评分流程', () => {
  test('成员登录后能进入评分页并看到评分输入或提交状态', async ({ page }) => {
    await login(page, MEMBER_USER, DEFAULT_PASS)
    await expect(page.locator('.page-grid')).toBeVisible()

    const scoreInputs = page.locator('input[type="number"]')
    const hasInputs = await scoreInputs.count()
    if (hasInputs > 0) {
      await expect(scoreInputs.first()).toBeVisible()
    } else {
      await expect(page.getByText(/已提交|提交状态|暂无评分项/)).toBeVisible()
    }
  })
})

test.describe('结果公示与遮罩', () => {
  test('普通成员在未公示时看到遮罩骨架或已公示状态', async ({ page }) => {
    await login(page, MEMBER_USER, DEFAULT_PASS)
    await page.getByRole('button', { name: '结果公示' }).click()
    await page.waitForURL('**/public/results', { timeout: 10000 })
    await expect(page.locator('.page-grid')).toBeVisible()

    const veilCount = await page.locator('.masked-surface__veil').count()
    if (veilCount > 0) {
      await expect(page.locator('.masked-surface__veil').first()).toBeVisible()
    } else {
      await expect(page.getByRole('heading', { name: '最终得分与排名' })).toBeVisible()
    }
  })

  test('管理员在结果公示页不显示遮罩', async ({ page }) => {
    await login(page, ADMIN_USER, DEFAULT_PASS)
    await page.getByRole('button', { name: '结果公示' }).click()
    await page.waitForURL('**/public/results', { timeout: 10000 })
    await expect(page.locator('.masked-surface__veil')).toHaveCount(0)
  })

  test('组长在结果公示页也不显示遮罩', async ({ page }) => {
    await login(page, LEADER_USER, DEFAULT_PASS)
    await page.getByRole('button', { name: '结果公示' }).click()
    await page.waitForURL('**/public/results', { timeout: 10000 })
    await expect(page.locator('.masked-surface__veil')).toHaveCount(0)
  })
})
