import logo from '@/assets/logo.png'
import { lineChatUrl, type GalleryItem, type MenuData } from '@/api/menu'
import { doodle, esc, page } from '@/features/book/pages'

/**
 * The photo book's pages (mock/gallery-book.html, mock/gallery-notepad.html) as HTML, shared by the side-bound book
 * on wide screens and the top-bound notepad on phones. Videos get a page of their own; photos go two to a page.
 */
export interface Sheet {
  kind: 'cover' | 'paper' | 'back'
  html: string
  center?: boolean
}

const snap = (g: GalleryItem, k: number) => {
  const media = g.video
    ? // no poster uploaded: #t=0.1 makes browsers show the first frame instead of a blank box
      `<video class="ph" src="${esc(g.video)}${g.image ? '' : '#t=0.1'}"${g.image ? ` poster="${esc(g.image)}"` : ''} ${g.preview ? ` style="background:url('${g.preview}') center/cover"` : ''} muted loop playsinline preload="metadata"></video>`
    : // the preview sits under the photo as a second background layer: it shows until the photo has loaded
      `<div class="ph" style="background-image:url('${esc(g.image)}')${g.preview ? `,url('${g.preview}')` : ''}" role="img" aria-label="${esc(g.caption)}"></div>`
  return `<div class="snap" style="--r:${k % 2 ? 2.2 : -2.2}deg"><span class="tape"></span>${media}<p>${esc(g.caption) || '&nbsp;'}</p></div>`
}

export function buildSheets({ gallery, line, social }: MenuData, openHint: string): Sheet[] {
  const out: Sheet[] = []
  out.push({
    kind: 'cover',
    center: true,
    html: `${doodle('leaf', 'left:9%;top:9%;width:20cqw;transform:rotate(-10deg)')}${doodle('whisk', 'right:8%;bottom:5%;width:13cqw;transform:rotate(16deg)')}
      <div class="plate"><div class="logo" role="img" aria-label="June" style="--logo:url('${logo}')"></div><div class="rule"></div><div class="kicker">สมุดรูปจากครัว</div></div>
      <div class="cap" style="margin-top:6cqh;opacity:.8">${esc(openHint)}</div>`,
  })
  let pair: GalleryItem[] = []
  let k = 0
  const flush = () => {
    if (!pair.length) return
    out.push({ kind: 'paper', html: `<div class="snaps${pair.length === 1 ? ' one' : ''}">${pair.map((g) => snap(g, k++)).join('')}</div>` })
    pair = []
  }
  for (const g of gallery) {
    if (g.video) {
      flush()
      out.push({ kind: 'paper', html: `<div class="h-num">วิดีโอ</div><div class="snaps one">${snap(g, k++)}</div>` })
    } else {
      pair.push(g)
      if (pair.length === 2) flush()
    }
  }
  flush()
  out.push({
    kind: 'paper',
    center: true,
    html: `${doodle('whisk', 'position:relative;width:16cqw;margin-bottom:4cqh')}
      <div class="h-name" style="font-size:9cqw">อยากชิมแล้ว?</div><div class="h-desc" style="margin:2cqh 0 5cqh">ทักมาสั่งทาง LINE ได้เลย</div>
      <a class="order" href="${esc(lineChatUrl(line.oaId))}" target="_blank" rel="noopener">สั่งทาง LINE</a>`,
  })
  if (social.instagram) {
    out.push({
      kind: 'paper',
      center: true,
      html: `${doodle('sparkle', 'position:relative;width:18cqw;margin-bottom:4cqh')}
        <div class="h-name" style="font-size:9cqw">ติดตามรูปใหม่</div><div class="h-desc" style="margin:2cqh 0 5cqh">ร้านลงรูปขนมใหม่ทุกวัน</div>
        <a class="order" href="${esc(social.instagram)}" target="_blank" rel="noopener">Instagram ของร้าน</a>`,
    })
  }
  out.push({
    kind: 'back',
    center: true,
    html: `<div class="plate"><div class="brand" style="font-size:13cqw">ขอบคุณนะ</div><div class="rule"></div><div class="kicker">June · อบใหม่ทุกวัน</div></div>`,
  })
  return out
}

/** sheets as page-flip pages for FlipBook */
export const toFlipPages = (sheets: Sheet[]) =>
  sheets.map((s) =>
    s.kind === 'paper'
      ? page(s.center ? 'center' : '', s.center ? `<div class="centered">${s.html}</div>` : s.html)
      : page('cover', s.html, true),
  )

/** the page that evens out an odd page count on a spread */
export const FILLER = page('center', `<div class="centered">${doodle('sparkle', 'position:relative;width:16cqw;margin-bottom:4cqh')}<div class="h-name" style="font-size:9cqw">แล้วเจอกันนะ</div><div class="h-desc">อบใหม่ทุกวันที่ June</div></div>`)
