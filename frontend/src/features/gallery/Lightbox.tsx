import './lightbox.css'
import { useEffect, useRef } from 'react'
import type { GalleryItem } from '@/api/menu'

/** Full-screen view of one snapshot: swipe or ← → for the next, Esc / tap outside / × to close. */
export function Lightbox({ items, index, onIndex, onClose }: { items: GalleryItem[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const item = items[index]
  const n = items.length
  const go = (d: number) => onIndex((index + d + n) % n)
  const startX = useRef<number | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onIndex((index + 1) % n)
      if (e.key === 'ArrowLeft') onIndex((index - 1 + n) % n)
    }
    addEventListener('keydown', onKey)
    const html = document.documentElement
    const before = html.style.overflow
    html.style.overflow = 'hidden' // no page scrolling behind the viewer
    return () => {
      removeEventListener('keydown', onKey)
      html.style.overflow = before
    }
  }, [index, n, onIndex, onClose])

  if (!item) return null
  return (
    <div
      className="lb"
      role="dialog"
      aria-modal="true"
      aria-label={item.caption || `รูปที่ ${index + 1}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onPointerDown={(e) => (startX.current = e.clientX)}
      onPointerUp={(e) => {
        if (startX.current === null) return
        const dx = e.clientX - startX.current
        startX.current = null
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
      }}
    >
      <button type="button" className="lb-x" aria-label="ปิด" onClick={onClose}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
      <div className="lb-stage" onClick={(e) => e.target === e.currentTarget && onClose()}>
        {item.video ? (
          <video key={item.id} src={item.video} poster={item.image || undefined} muted loop playsInline autoPlay controls />
        ) : (
          <img key={item.id} src={item.image} alt={item.caption} style={item.preview ? { background: `url("${item.preview}") center / cover` } : undefined} />
        )}
      </div>
      <p className="lb-cap">{item.caption}</p>
      <div className="lb-row">
        <button type="button" aria-label="รูปก่อน" onClick={() => go(-1)}>
          ←
        </button>
        <span>
          {index + 1} / {n}
        </span>
        <button type="button" aria-label="รูปถัดไป" onClick={() => go(1)}>
          →
        </button>
      </div>
    </div>
  )
}
