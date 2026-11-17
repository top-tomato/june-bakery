import './snaps.css'
import { useEffect, useRef, type CSSProperties } from 'react'
import type { GalleryItem } from '@/api/menu'

/** Rotations for the taped snapshots (cycled), so the board looks hand-pinned, not gridded. */
const TILT = [-2, 2, 3, -3, 1.5, -1.5]

/** The tiny preview behind a photo/video: a soft blur of it until the real file has loaded. */
const blur = (preview: string): CSSProperties | undefined => (preview ? { background: `url("${preview}") center / cover` } : undefined)

/**
 * Taped polaroid snapshots on dot paper (mock/gallery-all.html). Videos play silently only while on screen.
 * `dropAfter`: snapshots start lifted and drop onto the page as they come into view, no sooner than this many ms
 * after mount (so on /gallery they land just as the opening curtain lifts). `onOpen` makes each one a button.
 */
export function Snapshots({ items, dropAfter, onOpen }: { items: GalleryItem[]; dropAfter?: number; onOpen?: (index: number) => void }) {
  const board = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = board.current
    if (!el) return
    const vids = new IntersectionObserver((entries) =>
      entries.forEach((e) => {
        const v = e.target as HTMLVideoElement
        if (e.isIntersecting) void v.play().catch(() => {})
        else v.pause()
      }),
    )
    el.querySelectorAll('video').forEach((v) => vids.observe(v))

    let drops: IntersectionObserver | null = null
    const timers: number[] = []
    if (dropAfter !== undefined) {
      const start = performance.now() + dropAfter
      let queued = 0 // stagger the ones that arrive together
      drops = new IntersectionObserver(
        (entries) =>
          entries.forEach((e) => {
            if (!e.isIntersecting) return
            drops?.unobserve(e.target)
            const wait = Math.max(0, start - performance.now()) + queued++ * 110
            timers.push(
              window.setTimeout(() => {
                e.target.classList.add('drop')
                e.target.classList.remove('pre')
                queued = Math.max(0, queued - 1)
              }, wait),
            )
          }),
        { rootMargin: '0px 0px -8% 0px' },
      )
      el.querySelectorAll('.gsnap').forEach((f) => drops?.observe(f))
    }
    return () => {
      vids.disconnect()
      drops?.disconnect()
      timers.forEach(clearTimeout)
    }
  }, [items, dropAfter])

  return (
    <div className="board" ref={board}>
      {items.map((p, k) => (
        <figure
          key={p.id}
          className={`gsnap${p.video || k % 7 === 0 ? ' tall' : ''}${dropAfter !== undefined ? ' pre' : ''}`}
          style={{ '--r': `${TILT[k % TILT.length]}deg` } as CSSProperties}
          {...(onOpen
            ? {
                role: 'button',
                tabIndex: 0,
                'aria-label': p.caption || `รูปที่ ${k + 1}`,
                onClick: () => onOpen(k),
                onKeyDown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(k)),
              }
            : null)}
        >
          <span className={k % 2 ? 'gtape g' : 'gtape'} />
          {p.video ? (
            <video
              src={p.image ? p.video : `${p.video}#t=0.1`}
              poster={p.image || undefined}
              style={blur(p.preview)}
              muted
              loop
              playsInline
              preload="metadata"
              aria-label={p.caption}
            />
          ) : (
            <img src={p.image} alt={p.caption} loading="lazy" decoding="async" style={blur(p.preview)} />
          )}
          {p.video && <span className="badge">วิดีโอ</span>}
          {p.caption && <figcaption>{p.caption}</figcaption>}
        </figure>
      ))}
    </div>
  )
}
