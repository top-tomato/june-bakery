import { fullName, lineChatUrl, priceLabel, type MenuData } from '@/api/menu'

/**
 * The menu book's pages as HTML (mock/menu-book-v2.html). page-flip takes over and moves these elements itself, so they
 * are built outside React and every piece of data is escaped here.
 */
export const esc = (s: string | number) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)

// hand-drawn line art in one stroke style (the shop wants SVG, never emoji)
const DOODLES = {
  leaf: '<path class="dd" d="M8 92C28 66 58 34 94 8C74 42 46 72 8 92Z"/><path class="dd" d="M8 92C40 64 64 40 94 8"/><path class="dd" d="M30 92C44 70 60 52 78 36"/>',
  coconut: '<path class="dd" d="M8 52a42 38 0 0 0 84 0Z"/><path class="dd" d="M18 52a32 28 0 0 0 64 0"/><path class="dd peach" d="M38 70l2 1M52 74l2 0M64 68l1 2"/>',
  garlic: '<path class="dd" d="M50 8c2 16 20 26 28 46 10 26-12 38-28 38S12 80 22 54c8-20 26-30 28-46Z"/><path class="dd" d="M50 30c-7 20-7 44 0 62M50 30c7 20 7 44 0 62"/><path class="dd" d="M44 94l-2 4M56 94l2 4"/>',
  cake: '<path class="dd" d="M8 70l82-22v26L8 96Z"/><path class="dd" d="M8 70 50 22l40 26"/><path class="dd peach" d="M50 22c3-8 10-9 9 1"/><path class="dd" d="M8 82l82-22"/>',
  sparkle: '<path class="dd peach" d="M50 10l5 35 35 5-35 5-5 35-5-35-35-5 35-5Z"/>',
  whisk: '<path class="dd" d="M50 96V58"/><path class="dd" d="M50 58C26 40 30 6 50 6s24 34 0 52Z"/><path class="dd" d="M50 58C40 40 42 10 50 6M50 58c10-18 8-48 0-52"/>',
} as const
export type Doodle = keyof typeof DOODLES
export const doodle = (k: Doodle, css: string) => `<svg class="d" viewBox="0 0 100 100" style="${css}" aria-hidden="true">${DOODLES[k]}</svg>`
const RING =
  '<svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path class="dd peach" style="stroke-width:2.6" d="M10 34C8 12 90 6 94 28 98 52 12 58 6 34 4 20 30 10 62 9"/></svg>'
const CAKE_DOODLES: Doodle[] = ['leaf', 'garlic', 'coconut', 'cake']


export const page = (cls: string, body: string, hard = false) =>
  `<div class="pg ${cls}"${hard ? ' data-density="hard"' : ''}><div class="in"><div class="pad"${cls.includes('center') ? ' style="justify-content:center"' : ''}>${body}</div></div></div>`

export function buildPages({ products, line }: MenuData): string[] {
  const chat = (text?: string) => esc(lineChatUrl(line.oaId, text))
  const cakePage = (i: number) => 3 + i * 2
  const howPage = 3 + products.length * 2
  const P: string[] = []

  P.push(
    page(
      'cover',
      `${doodle('leaf', 'left:10%;top:8%;width:22cqw;transform:rotate(-10deg)')}${doodle('whisk', 'right:8%;bottom:4%;width:14cqw;transform:rotate(16deg)')}
      <div class="plate"><div class="brand">June <em>menu</em></div><div class="rule"></div><div class="kicker">สมุดเมนูขนมอบใหม่</div></div>
      <div class="cap" style="margin-top:7cqh;opacity:.8">ลากมุมขวาล่างเพื่อเปิด →</div>`,
      true,
    ),
  )
  P.push(
    page(
      'left center',
      `${doodle('sparkle', 'right:12%;top:10%;width:12cqw')}
      <div class="h-hand">สวัสดีค่ะ</div>
      <div class="h-desc" style="margin-top:2cqh">ขนมทุกชิ้นของ June อบมาใหม่ทุกวัน<br><br>พลิกดูได้เลย ชอบชิ้นไหนกดสั่งทาง LINE ได้ทันที</div>
      <div class="h-hand" style="margin-top:4cqh;color:var(--peach)">— June</div>
      ${doodle('cake', 'left:12%;bottom:8%;width:24cqw')}`,
    ),
  )
  P.push(
    page(
      'right',
      `<div class="h-num">สารบัญ</div><div class="h-name" style="font-size:9cqw">วันนี้มีอะไรบ้าง</div>
      <ul class="toc">${products.map((p, i) => `<li><button type="button" data-go="${cakePage(i)}">${esc(fullName(p))}<span></span><b>${cakePage(i)}</b></button></li>`).join('')}
        <li><button type="button" data-go="${howPage}">วิธีสั่ง<span></span><b>${howPage + 1}</b></button></li></ul>
      ${doodle('coconut', 'right:12%;bottom:7%;width:24cqw')}`,
    ),
  )
  products.forEach((p, i) => {
    P.push(
      page(
        'left',
        `<div class="h-num">เมนูที่ ${i + 1}</div>
        <div class="photo" style="background-image:url('${esc(p.image)}')"><i></i><i></i><i></i><i></i></div>
        <div class="caption">${esc(p.highlights[0] ?? p.description)} ${doodle('sparkle', 'position:relative;display:inline-block;width:6cqw;vertical-align:-1cqw')}</div>`,
      ),
    )
    P.push(
      page(
        'right',
        `${doodle(CAKE_DOODLES[i % CAKE_DOODLES.length] ?? 'cake', 'right:10%;top:6%;width:18cqw;transform:rotate(12deg)')}
        <div class="h-num">เมนูที่ ${i + 1}</div>
        <div class="h-name">${esc(p.name[0])}<br>${esc(p.name[1])}</div>
        <div class="h-desc">${esc(p.description)}</div>
        <ul class="notes">${p.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
        <div class="buy"><span class="price${p.price == null ? ' ask' : ''}">${esc(priceLabel(p))}${p.price != null && p.priceUnit ? `<small>${esc(p.priceUnit)}</small>` : ''}${RING}</span><a class="order" href="${chat(`สนใจสั่ง ${fullName(p)}`)}" target="_blank" rel="noopener">สั่งทาง LINE</a></div>`,
      ),
    )
  })
  P.push(
    page(
      'left center',
      `<div style="text-align:center;display:grid;justify-items:center">${doodle('whisk', 'position:relative;width:26cqw;margin-bottom:4cqh')}
      <div class="h-name" style="font-size:9cqw">เมนูใหม่<br>เร็ว ๆ นี้</div>
      <div class="h-desc">อยากกินอะไร ทักมาบอกได้นะ</div></div>`,
    ),
  )
  P.push(
    page(
      'right',
      `<div class="h-num">วิธีสั่ง</div><div class="h-name" style="font-size:9cqw">ง่าย ๆ 3 ขั้น</div>
      <ol class="steps"><li>เลือกขนมจากสมุดเล่มนี้</li><li>กด "สั่งทาง LINE" หรือทักแอดมิน</li><li>รับที่ร้าน หรือให้ส่งถึงที่</li></ol>
      <div class="buy"><span></span><a class="order" href="${chat()}" target="_blank" rel="noopener">ทักแอดมิน</a></div>`,
    ),
  )
  P.push(
    page(
      'cover',
      `<div class="plate"><div class="brand" style="font-size:13cqw">ขอบคุณนะ</div><div class="rule"></div><div class="kicker">June · อบใหม่ทุกวัน</div></div>
      ${doodle('cake', 'left:14%;bottom:10%;width:22cqw')}`,
      true,
    ),
  )
  return P
}
