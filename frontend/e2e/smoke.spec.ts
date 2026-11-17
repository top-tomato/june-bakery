import { expect, test, type Page } from '@playwright/test'

// always on the page; reviews / about / gallery only appear once filled in via Django admin
const REQUIRED_SECTIONS = ['flavors', 'story', 'how', 'where', 'end']
async function expectRequiredSections(page: Page) {
  for (const id of REQUIRED_SECTIONS) await expect(page.locator(`section#${id}`)).toHaveCount(1)
}

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  return errors
}

test('home: intro finishes, the required sections render, scrolling the whole page throws nothing', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await expectRequiredSections(page)
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
  test.skip((await next.count()) === 0, 'only one cake on the menu')
  await next.click()
  await expect(page.locator('.pick h2')).not.toHaveText(first ?? '')
})

test('book: opens, flips, and links back home without a reload', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/book/')
  await expect(page.locator('.book-nav .count')).toHaveText('ปกหน้า')
  await page.getByRole('button', { name: 'หน้าถัดไป' }).click()
  await expect(page.locator('.book-nav .count')).not.toHaveText('ปกหน้า', { timeout: 3000 })
  // "←" must flip back too (it silently did nothing on phones: page-flip ignored its fake click)
  await page.getByRole('button', { name: 'หน้าถัดไป' }).click()
  const count = page.locator('.book-nav .count')
  await expect(count).not.toHaveText('ปกหน้า')
  await page.waitForTimeout(1200) // let the forward flip finish
  const before = await count.textContent()
  await page.getByRole('button', { name: 'หน้าก่อน' }).click()
  await expect(count).not.toHaveText(before ?? '', { timeout: 3000 })
  // rings must sit inside page-flip's layer so the turning page covers them
  await expect(page.locator('.stf__block > .book-rings')).toHaveCount(1)
  await page.locator('.book-back').click()
  await expect(page).toHaveURL(/\/$/)
  await expectRequiredSections(page)
  expect(errors.filter((e) => !/favicon/.test(e))).toEqual([])
})

test('photo book: opens on /gallery, turns forward and back, links back to the photo section', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/gallery/')
  const count = page.locator('.book-nav .count')
  const hasPhotos = await count.count()
  test.skip(!hasPhotos, 'no gallery photos in this database (filled in via Django admin)')
  await expect(count).toHaveText('ปกหน้า')
  // phones get the top-bound notepad, wide screens the side-bound book
  await expect(page.locator(page.viewportSize()!.width < 700 ? '.notepad .np' : '.book-stage')).toHaveCount(1)
  await page.getByRole('button', { name: 'หน้าถัดไป' }).click()
  await expect(count).not.toHaveText('ปกหน้า', { timeout: 3000 })
  await page.getByRole('button', { name: 'หน้าถัดไป' }).click()
  await page.waitForTimeout(1200)
  const before = await count.textContent()
  await page.getByRole('button', { name: 'หน้าก่อน' }).click()
  await expect(count).not.toHaveText(before ?? '', { timeout: 3000 })
  // quick taps never leave a notepad page half-turned
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'หน้าถัดไป' }).click({ force: true })
  await page.waitForTimeout(1500)
  await expect(page.locator('.np-curl')).toHaveCount(0)
  await page.locator('.book-back').click()
  await expect(page).toHaveURL(/\/#gallery$/)
  expect(errors.filter((e) => !/favicon/.test(e))).toEqual([])
})
