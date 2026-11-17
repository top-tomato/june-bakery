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

test('gallery: /gallery shows every photo, opens one full screen, steps through, links home', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/gallery/')
  const snaps = page.locator('.gal-page .gsnap')
  test.skip(!(await snaps.count()), 'no gallery photos in this database (filled in via the staff upload page)')
  // they drop in after the opening curtain
  await expect(snaps.first()).not.toHaveClass(/\bpre\b/, { timeout: 6000 })
  await snaps.first().click()
  const counter = page.locator('.lb-row span')
  await expect(counter).toHaveText(`1 / ${await snaps.count()}`)
  await page.getByRole('button', { name: 'รูปถัดไป' }).click()
  await expect(counter).toHaveText(/^2 \//)
  await page.keyboard.press('Escape')
  await expect(page.locator('.lb')).toHaveCount(0)
  await page.locator('.gal-back').click()
  await expect(page).toHaveURL(/\/$/)
  expect(errors.filter((e) => !/favicon/.test(e))).toEqual([])
})
