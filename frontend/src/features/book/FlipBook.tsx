import './book.css'
import { Link } from '@tanstack/react-router'
import { PageFlip, type FlipState } from 'page-flip'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { viewportHeight } from '@/lib/env'
import { bookLayout, PAGE_RATIO } from './layout'

/**
 * A spiral notebook that turns its pages (page-flip). Shared by the menu book (/book) and, on wide screens, the photo
 * book (/gallery). `pages` is HTML: the front cover first, the back cover last (both class "cover"), sheets between.
 *
 * Like a real notebook: with `insideCovers`, a two-page spread shows the inside of each cover as bare board, so the
 * paper starts on the right (the photo book). Phones show one page at a time and skip those bare insides. The menu book
 * doesn't use them: its first sheet is written on the inside of the cover, and each cake's photo faces its details. Left/right (holes, gutter shadow) come from each sheet's
 * position, never from the page builder, so they're right whatever the page count.
 */

/** page-flip needs an even page count; an odd one gets `filler` (or a plain sheet) before the back cover */
const INSIDE = '<div class="pg inside" data-density="hard"><div class="in"></div></div>'
const SHEET = '<div class="pg"><div class="in"></div></div>'

function assemble(pages: string[], insides: boolean, filler?: string) {
  const body = pages.slice(1, -1)
  const out: string[] = [pages[0] ?? SHEET]
  const map: number[] = [0] // index in `pages` -> index in the book (data-go links use `pages` indexes)
  if (insides) out.push(INSIDE)
  body.forEach((p, k) => {
    map[k + 1] = out.length
    out.push(p)
  })
  if (body.length % 2) out.push(filler ?? SHEET)
  if (insides) out.push(INSIDE)
  map[pages.length - 1] = out.length
  out.push(pages[pages.length - 1] ?? SHEET)
  return { html: out, map }
}

/**
 * page-flip's flipPrev() works by faking a click near the left edge. With disableFlipByClick on (we use page taps for
 * zoom), that fake click is ignored on phones, where the left edge isn't a page corner, so "←" did nothing.
 * Allow click-flips just for this call.
 */
function withClickFlip(pf: PageFlip | null, run: (pf: PageFlip) => void) {
  if (!pf) return
  const s = pf.getSettings()
  s.disableFlipByClick = false
  run(pf)
  s.disableFlipByClick = true
}
const flipPrev = (pf: PageFlip | null) => withClickFlip(pf, (f) => f.flipPrev())
/** jumping to an earlier page (contents links) goes through the same fake click */
const flipTo = (pf: PageFlip | null, page: number) => withClickFlip(pf, (f) => f.flip(page))

// Rebuild the book only when the layout really changes: width changes (rotation, desktop window resize) or the frozen
// viewport height changes (rotation). Phone toolbars sliding in and out don't count.
const layoutKey = () => {
  const l = bookLayout(innerWidth, viewportHeight())
  return `${l.single ? 's' : 'd'}:${l.pageW}`
}
export const subscribeLayout = (cb: () => void) => {
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
/** current book layout, re-rendering when it changes */
export function useBookLayout() {
  const key = useSyncExternalStore(subscribeLayout, layoutKey)
  const [mode, w] = key.split(':')
  return { key, single: mode === 's', pageW: Number(w) }
}

export interface FlipBookProps {
  pages: string[]
  filler?: string
  hint: string
  back: ReactNode
  /** open the cover by itself shortly after the book appears */
  autoOpen?: boolean
  /** view-transition-name for the closed book (the photo book morphs in from the homepage) */
  vtName?: string
  /** bare board inside each cover on a spread (see above) */
  insideCovers?: boolean
}

export function FlipBook(props: FlipBookProps) {
  const { key, single, pageW } = useBookLayout()
  return <Book key={key} {...props} single={single} pageW={pageW} />
}

function Book({ pages, filler, hint, back, autoOpen, vtName, insideCovers, single, pageW }: FlipBookProps & { single: boolean; pageW: number }) {
  const insides = !!insideCovers && !single
  const stageRef = useRef<HTMLDivElement>(null)
  const bookRef = useRef<HTMLDivElement>(null)
  const ringsRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const flipRef = useRef<PageFlip | null>(null)
  const [index, setIndex] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const built = useMemo(() => assemble(pages, insides, filler), [pages, insides, filler])
  const total = built.html.length

  useEffect(() => {
    const book = bookRef.current, rings = ringsRef.current, stage = stageRef.current
    if (!book || !rings || !stage) return
    // page-flip owns these nodes from here on (React renders #book empty and never touches its children)
    book.innerHTML = built.html.join('')
    const sheets = [...book.querySelectorAll<HTMLElement>('.pg')]
    sheets.forEach((el, i) => {
      if (el.classList.contains('cover')) return
      el.classList.remove('left', 'right')
      el.classList.add(i % 2 ? 'left' : 'right') // with showCover, odd = left page
    })
    sheets[sheets.length - 1]?.classList.add('back')
    book.querySelectorAll<HTMLElement>('[data-go]').forEach((el) => {
      el.dataset.go = String(built.map[Number(el.dataset.go)] ?? 0)
    })

    const pf = new PageFlip(book, {
      width: pageW,
      height: Math.round(pageW / PAGE_RATIO),
      size: 'fixed',
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
    pf.loadFromHTML(sheets)
    // page-flip puts the book in its own layer; the rings must live inside it to sit under the turning page
    book.querySelector('.stf__block')?.prepend(rings)
    flipRef.current = pf

    // only the open pages play their videos (photo book)
    const syncVideos = (i: number) =>
      sheets.forEach((el, j) =>
        el.querySelectorAll('video').forEach((v) => {
          if (j >= i - 1 && j <= i + 1 && i > 0) void v.play().catch(() => {})
          else v.pause()
        }),
      )
    let state: FlipState = 'read'
    pf.on('flip', (e) => {
      setIndex(e.data)
      syncVideos(e.data)
    })
    pf.on('changeState', (e) => (state = e.data))
    const opener = autoOpen ? window.setTimeout(() => pf.flipNext(), 900) : 0

    const onClick = (e: MouseEvent) => {
      const target = e.target as Element
      const go = target.closest<HTMLElement>('[data-go]')
      if (go) return flipTo(pf, Number(go.dataset.go))
      if (target.closest('a,button,video') || single || state !== 'read') return
      const pg = target.closest<HTMLElement>('.pg')
      if (!pg || pg.classList.contains('cover') || pg.classList.contains('inside') || !sheetRef.current) return
      // tap a page on the small spread to read it full size: show a clean copy without page-flip's classes/styles
      const copy = pg.cloneNode(true) as HTMLElement
      copy.removeAttribute('style')
      copy.className = [...copy.classList].filter((c) => !c.startsWith('stf__') && !c.startsWith('--')).join(' ')
      sheetRef.current.replaceChildren(copy)
      setZoomed(true)
    }
    book.addEventListener('click', onClick)
    return () => {
      clearTimeout(opener)
      book.removeEventListener('click', onClick)
      stage.append(rings) // give the rings back before page-flip removes its layer
      pf.destroy()
      flipRef.current = null
    }
  }, [built, single, pageW, autoOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomed(false)
      if (e.key === 'ArrowRight') flipRef.current?.flipNext()
      if (e.key === 'ArrowLeft') flipPrev(flipRef.current)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  const last = total - 1
  const read = last > 0 ? index / last : 0
  // page numbers count paper only (not the bare cover insides on a spread)
  const off = insides ? 1 : 0
  const sheetsTotal = total - 2 - 2 * off
  const a = Math.max(1, index - off)
  const z = Math.min(index + 1 - off, sheetsTotal)
  const label = index === 0 ? 'ปกหน้า' : index === last ? 'ปกหลัง' : single ? `หน้า ${a} / ${sheetsTotal}` : a === z ? `หน้า ${a}` : `หน้า ${a}–${z}`
  const shift = single ? '' : index === 0 ? ' closed-front' : index === last ? ' closed-back' : ''
  // A side's stack is the paper under it. A closed book shows none (the cover hides it); next to a cover there is
  // only the cover board under that side, and while flipping onto the cover it would flash as a blank sheet.
  const leftStack = !(index <= 1 || index === last)
  const rightStack = !(index === 0 || index >= last - (single ? 1 : 2))

  return (
    <div className="book-page">
      {back}
      <p className="book-hint">{hint}</p>
      <div ref={stageRef} className={single ? 'book-stage single' : 'book-stage'} style={{ width: single ? pageW : pageW * 2 }}>
        <div className={`book-shift${shift}`} style={vtName ? { viewTransitionName: vtName } : undefined}>
          <div className="book-edges" style={{ '--l': read.toFixed(2), '--r': (1 - read).toFixed(2) } as CSSProperties}>
            <i className="l" style={{ opacity: leftStack ? 1 : 0 }} />
            <i className="r" style={{ opacity: rightStack ? 1 : 0 }} />
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
            flipTo(flipRef.current, Number(go.dataset.go))
          } else if (e.target === e.currentTarget) setZoomed(false)
        }}
      >
        <div ref={sheetRef} className="sheet" />
        <button type="button" className="close" onClick={() => setZoomed(false)}>
          ปิด
        </button>
      </div>
      <nav className="book-nav" aria-label="พลิกหน้า">
        <button type="button" aria-label="หน้าก่อน" disabled={index === 0} onClick={() => flipPrev(flipRef.current)}>
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

/** "← หน้าแรก" for the top-left corner */
export function BackHome({ hash }: { hash?: string }) {
  return (
    <Link to="/" hash={hash} className="book-back">
      ← หน้าแรก
    </Link>
  )
}
