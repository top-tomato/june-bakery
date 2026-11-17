import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, type CSSProperties } from 'react'
import type { MenuData } from '@/api/menu'
import { BookIcon } from '@/components/icons'
import { ALBUM, markArriving } from '@/features/gallery/handoff'
import { calm, viewportHeight } from '@/lib/env'
import { Drips } from './Drips'

/** Optional sections: each one only renders once the shop has filled it in (Django admin). */

export function Reviews({ reviews, above }: { reviews: MenuData['reviews']; above: string }) {
  return (
    <section className="reviews" id="reviews" data-nav="light">
      <Drips count={22} color={above} />
      <div className="wrap">
        <p className="kicker">คนที่ลองแล้ว</p>
        <h2 className="sec-title">เสียงจากลูกค้า</h2>
        <div className="quotes">
          {reviews.map((r) => (
            <figure key={r.id} className="quote">
              <blockquote>“{r.text}”</blockquote>
              <figcaption>— {r.author}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

export function About({ about, above }: { about: NonNullable<MenuData['about']>; above: string }) {
  return (
    <section className="about" id="about" data-nav="dark">
      <Drips count={22} color={above} />
      <div className={about.photo ? 'wrap about-grid' : 'wrap'}>
        {about.photo && <img className="about-photo" src={about.photo} alt="" loading="lazy" decoding="async" />}
        <div>
          <p className="kicker">เรื่องของ June</p>
          {about.title && <h2 className="sec-title">{about.title}</h2>}
          <p className="about-text">{about.text}</p>
        </div>
      </div>
    </section>
  )
}

/** Rotations for the taped snapshots (cycled), so the board looks hand-pinned, not gridded. */
const TILT = [-2, 2, 3, -3, 1.5, -1.5]
const SHOWN = 6

/**
 * The homepage's photo section as one scrapbook page (mock/gallery-scrapbook.html): taped snapshots on dot paper,
 * videos playing silently while on screen. "เปิดสมุดรูปทั้งเล่ม" gathers the snapshots on screen into a pile, then
 * the top one morphs into the closed photo book (/gallery). id="gallery": linkable as /#gallery.
 */
export function Gallery({ photos, above }: { photos: MenuData['gallery']; above: string }) {
  const navigate = useNavigate()
  const board = useRef<HTMLDivElement>(null)
  const shown = photos.slice(0, SHOWN)

  // play videos only while they're on screen
  useEffect(() => {
    const vids = board.current?.querySelectorAll('video')
    if (!vids?.length) return
    const io = new IntersectionObserver((entries) =>
      entries.forEach((e) => {
        const v = e.target as HTMLVideoElement
        if (e.isIntersecting) void v.play().catch(() => {})
        else v.pause()
      }),
    )
    vids.forEach((v) => io.observe(v))
    return () => io.disconnect()
  }, [])

  const open = async (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return // let new-tab clicks through
    e.preventDefault()
    if (calm || !document.startViewTransition || !board.current) return void navigate({ to: '/gallery' })
    const top = await gatherIntoPile(board.current)
    if (!top) return void navigate({ to: '/gallery' })
    markArriving()
    top.style.viewTransitionName = ALBUM
    document.startViewTransition(async () => {
      top.style.viewTransitionName = ''
      await navigate({ to: '/gallery' })
      await new Promise((r) => setTimeout(r, 60)) // let the book build before the new state is captured
    })
  }

  return (
    <section className="gallery" id="gallery" data-nav="dark">
      <Drips count={22} color={above} />
      <div className="wrap">
        <p className="kicker">สมุดรูป</p>
        <h2 className="sec-title">จากครัว June</h2>
        <p className="gal-sub">อบเสร็จ ถ่ายเก็บไว้ทุกวัน</p>
        <div className="board" ref={board}>
          {shown.map((p, k) => (
            <figure key={p.id} className={p.video || k === 0 ? 'gsnap tall' : 'gsnap'} style={{ '--r': `${TILT[k % TILT.length]}deg` } as CSSProperties}>
              <span className={k % 2 ? 'gtape g' : 'gtape'} />
              {p.video ? (
                <video src={p.image ? p.video : `${p.video}#t=0.1`} poster={p.image || undefined} muted loop playsInline preload="metadata" aria-label={p.caption} />
              ) : (
                <img src={p.image} alt={p.caption} loading="lazy" decoding="async" />
              )}
              {p.video && <span className="badge">วิดีโอ</span>}
              {p.caption && <figcaption>{p.caption}</figcaption>}
            </figure>
          ))}
        </div>
        <div className="more">
          <a className="btn" href="/gallery/" onClick={(e) => void open(e.nativeEvent)}>
            <BookIcon />
            เปิดสมุดรูปทั้งเล่ม
          </a>
        </div>
      </div>
    </section>
  )
}

/** Fly the snapshots on screen to the middle into a small messy stack; resolves with the card on top. */
function gatherIntoPile(board: HTMLElement): Promise<HTMLElement | null> {
  const cx = innerWidth / 2
  const cy = viewportHeight() / 2
  const size = Math.min(innerWidth * 0.62, 280)
  const cards = [...board.querySelectorAll<HTMLElement>('.gsnap')].filter((el) => {
    const r = el.getBoundingClientRect()
    return r.bottom > 0 && r.top < viewportHeight()
  })
  const top = cards[cards.length - 1]
  if (!top) return Promise.resolve(null)
  const anims = cards.map((el, k) => {
    const r = el.getBoundingClientRect()
    el.style.zIndex = String(10 + k)
    const tilt = [-7, 5, -3, 8, -5, 3][k % 6] ?? 0
    return el.animate(
      [
        { transform: getComputedStyle(el).transform },
        { transform: `translate(${cx - (r.left + r.width / 2)}px, ${cy - (r.top + r.height / 2)}px) scale(${size / r.width}) rotate(${tilt}deg)` },
      ],
      { duration: 520, delay: k * 45, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' },
    )
  })
  return Promise.all(anims.map((a) => a.finished)).then(() => top)
}
