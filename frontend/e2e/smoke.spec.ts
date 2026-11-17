import { expect, test, type Page } from '@playwright/test'

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  return errors
}

test('home: intro finishes, every section renders, scrolling the whole page throws nothing', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await expect(page.locator('section')).toHaveCount(4)
  await expect(page.locator('.curtain')).toHaveCount(0, { timeout: 8000 }) // removes itself after the intro
  await expect(page.locator('.hero h1')).toContainText('อบใหม่ หอม')

  // the order button in the story section points at LINE with the cake's name
  await expect(page.locator('#story .buy a')).toHaveAttribute('href', /line\.me\/R\/oaMessage\//)

  // scroll down and back up in steps, like a fast thumb
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto'
    const H = document.documentElement.scrollHeight - innerHeight
    for (const k of [...Array(41).keys(), ...[...Array(41).keys()].reverse()]) {
      scrollTo(0, (H * k) / 40)
      await new Promise((r) => requestAnimationFrame(r))
    }
  })
  await expect(page.locator('.map img')).toBeVisible()
  expect(errors.filter((e) => !/favicon/.test(e))).toEqual([])
})

test('home: switching cakes updates the hero and the story', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.curtain')).toHaveCount(0, { timeout: 8000 })
  const first = await page.locator('.pick h2').textContent()
  const next = page.getByRole('button', { name: 'เมนูถัดไป' })
  test.skip(await next.isDisabled(), 'only one cake on the menu')
  await next.click()
  await expect(page.locator('.pick h2')).not.toHaveText(first ?? '')
})

test('book: opens, flips, and links back home without a reload', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/book/')
  await expect(page.locator('.book-nav .count')).toHaveText('ปกหน้า')
  await page.getByRole('button', { name: 'หน้าถัดไป' }).click()
  await expect(page.locator('.book-nav .count')).not.toHaveText('ปกหน้า', { timeout: 3000 })
  // rings must sit inside page-flip's layer so the turning page covers them
  await expect(page.locator('.stf__block > .book-rings')).toHaveCount(1)
  await page.locator('.book-back').click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('section')).toHaveCount(4)
  expect(errors.filter((e) => !/favicon/.test(e))).toEqual([])
})
