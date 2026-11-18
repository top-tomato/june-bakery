// Draws the link-preview text layers from menu/assets/og/source.html into transparent PNGs next to it.
// Run after changing that file:  cd frontend && npm run og:layers
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../menu/assets/og')
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } })
await page.goto('file://' + path.join(dir, 'source.html'), { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.locator('#home').screenshot({ path: path.join(dir, 'home-text.png'), omitBackground: true })
await page.locator('#badge').screenshot({ path: path.join(dir, 'gallery-badge.png'), omitBackground: true })
await browser.close()
console.log('wrote home-text.png, gallery-badge.png in', dir)
