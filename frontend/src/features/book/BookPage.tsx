import './book.css'
import { Link } from '@tanstack/react-router'
import { PageFlip, type FlipState } from 'page-flip'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import type { MenuData } from '@/api/menu'
import { viewportHeight } from '@/lib/env'
import { bookLayout, PAGE_RATIO } from './layout'
import { buildPages } from './pages'

// Rebuild the book only when the layout really changes: width changes (rotation, desktop window resize) or the frozen
// viewport height changes (rotation). Phone toolbars sliding in and out don't count.
const layoutKey = () => {
  const l = bookLayout(innerWidth, viewportHeight())
  return `${l.single ? 's' : 'd'}:${l.pageW}`
}
const subscribeLayout = (cb: () => void) => {
  let t = 0
  const onChange = () => {
    clearTimeout(t)
    t = window.setTimeout(cb, 150)
  }
  addEventListener('resize', onChange)
  addEventListener('vhchange', onChange)
  return () => {
    clearTimeout(t)
    removeEventListener('resize', onChange)
    removeEventListener('vhchange', onChange)
  }
}

export function BookPage({ data }: { data: MenuData }) {
  const key = useSyncExternalStore(subscribeLayout, layoutKey)
  const [mode, w] = key.split(':')
  const pageW = Number(w)
  return <Book key={key} data={data} single={mode === 's'} pageW={pageW} />
}

function Book({ data, single, pageW }: { data: MenuData; single: boolean; pageW: number }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const bookRef = useRef<HTMLDivElement>(null)
  const ringsRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const flipRef = useRef<PageFlip | null>(null)
  const [index, setIndex] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const pages = useMemo(() => buildPages(data), [data])
  const total = pages.length

  useEffect(() => {
    const stage = stageRef.current, book = bookRef.current, rings = ringsRef.current
    if (!stage || !book || !rings) return
    // page-flip owns these nodes from here on (React renders #book empty and never touches its children)
    book.innerHTML = pages.join('')

    // fixed page size worked out for this screen (layout.ts); a stage exactly 2 pages wide makes page-flip show a spread
    stage.style.width = `${single ? pageW : pageW * 2}px`
    const size = { width: pageW, height: Math.round(pageW / PAGE_RATIO), size: 'fixed' as const }

    const pf = new PageFlip(book, {
      ...size,
      usePortrait: true,
      showCover: true,
      startZIndex: 10,
      drawShadow: true,
      maxShadowOpacity: 0.4,
      flippingTime: 900,
      mobileScrollSupport: false,
      swipeDistance: 20,
      showPageCorners: true,
      disableFlipByClick: true,
    })
    pf.loadFromHTML(book.querySelectorAll<HTMLElement>('.pg'))
    // page-flip puts the book in its own layer; the rings must live inside it to sit under the turning page
    book.querySelector('.stf__block')?.prepend(rings)
    flipRef.current = pf

    let state: FlipState = 'read'
    pf.on('flip', (e) => setIndex(e.data))
    pf.on('changeState', (e) => (state = e.data))

    const onClick = (e: MouseEvent) => {
      const target = e.target as Element
      const go = target.closest<HTMLElement>('[data-go]')
      if (go) return pf.flip(Number(go.dataset.go))
      if (target.closest('a,button') || single || state !== 'read') return
      const pg = target.closest<HTMLElement>('.pg')
      if (!pg || pg.classList.contains('cover') || !sheetRef.current) return
      // tap a page on the small spread to read it full size: show a clean copy without page-flip's classes/styles
      const copy = pg.cloneNode(true) as HTMLElement
      copy.removeAttribute('style')
      copy.className = [...copy.classList].filter((c) => !c.startsWith('stf__') && !c.startsWith('--')).join(' ')
      sheetRef.current.replaceChildren(copy)
      setZoomed(true)
    }
    book.addEventListener('click', onClick)
    return () => {
      book.removeEventListener('click', onClick)
      stage.append(rings) // give the rings back before page-flip removes its layer
      pf.destroy()
      flipRef.current = null
    }
  }, [pages, single, pageW])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomed(false)
      if (e.key === 'ArrowRight') flipRef.current?.flipNext()
      if (e.key === 'ArrowLeft') flipRef.current?.flipPrev()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  const last = total - 1
  const read = last > 0 ? index / last : 0
  const label =
    index === 0 ? 'ปกหน้า' : index === last ? 'ปกหลัง' : single ? `หน้า ${index} / ${last - 1}` : `หน้า ${index}–${Math.min(index + 1, last - 1)}`
  const shift = single ? '' : index === 0 ? ' closed-front' : index === last ? ' closed-back' : ''

  return (
    <div className="book-page">
      <Link to="/" className="book-back">
        ← หน้าแรก
      </Link>
      <p className="book-hint">ปัดหรือลากมุมเพื่อพลิก{single ? '' : ' · แตะหน้าเพื่อดูใกล้ ๆ'}</p>
      <div ref={stageRef} className={single ? 'book-stage single' : 'book-stage'}>
        <div className={`book-shift${shift}`}>
          <div className="book-edges" style={{ '--l': read.toFixed(2), '--r': (1 - read).toFixed(2) } as CSSProperties}>
            <i className="l" style={{ opacity: index === 0 ? 0 : 1 }} />
            <i className="r" style={{ opacity: index === last ? 0 : 1 }} />
          </div>
          <div ref={bookRef} className="book" />
          <div ref={ringsRef} className="book-rings" aria-hidden="true" />
        </div>
      </div>
      <div
        className={zoomed ? 'book-zoom on' : 'book-zoom'}
        aria-hidden={!zoomed}
        onClick={(e) => {
          const go = (e.target as Element).closest<HTMLElement>('[data-go]')
          if (go) {
            setZoomed(false)
            flipRef.current?.flip(Number(go.dataset.go))
          } else if (e.target === e.currentTarget) setZoomed(false)
        }}
      >
        <div ref={sheetRef} className="sheet" />
        <button type="button" className="close" onClick={() => setZoomed(false)}>
          ปิด
        </button>
      </div>
      <nav className="book-nav" aria-label="พลิกหน้า">
        <button type="button" aria-label="หน้าก่อน" disabled={index === 0} onClick={() => flipRef.current?.flipPrev()}>
          ←
        </button>
        <span className="count">{label}</span>
        <button type="button" aria-label="หน้าถัดไป" disabled={index === last} onClick={() => flipRef.current?.flipNext()}>
          →
        </button>
      </nav>
    </div>
  )
}
