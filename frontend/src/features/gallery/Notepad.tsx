import '@/features/book/book.css'
import './notepad.css'
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { subscribeLayout } from '@/features/book/FlipBook'
import { calm, viewportHeight } from '@/lib/env'
import { onFrame } from '@/lib/frame'
import type { Sheet } from './pages'

/**
 * Phone photo book: a top-bound notepad (mock/gallery-notepad.html). A tall, narrow pad fits a phone screen, so each
 * page is bigger than a side-bound one. Each leaf is hinged at its top edge and turns rotateX 0 -> 180deg, up and over
 * the rings. Drag up/left to turn, down/right to bring the last page back, or use the buttons.
 *
 * While a leaf turns it is drawn as SEG strips chained hinge to hinge, each bent a little further than the last, so the
 * free edge curls up ahead of the hinge. The strips exist only during a turn; a leaf lying flat is one plain sheet.
 * Every leaf eases toward its resting place (turned if before `cur`, flat otherwise) from one frame job, so fast taps
 * just queue more leaves and none is ever left half-turned.
 */
const SEG = 6
const BEND = 60

const sizeKey = () => {
  const vh = viewportHeight()
  const h = vh - (vh < 560 ? 110 : 140)
  const w = Math.floor(Math.min(innerWidth - 24, h * 0.64, 460))
  return `${w}:${Math.round(Math.min(h, w / 0.64))}`
}

interface NotepadProps {
  sheets: Sheet[]
  hint: string
  back: ReactNode
  autoOpen?: boolean
  vtName?: string
}

export function Notepad(props: NotepadProps) {
  const key = useSyncExternalStore(subscribeLayout, sizeKey)
  const [w = 300, h = 470] = key.split(':').map(Number)
  return <Pad key={key} {...props} w={w} h={h} />
}

interface Engine {
  next: () => void
  prev: () => void
}

function Pad({ sheets, hint, back, autoOpen, vtName, w, h }: NotepadProps & { w: number; h: number }) {
  const padRef = useRef<HTMLDivElement>(null)
  const leafRefs = useRef<(HTMLDivElement | null)[]>([])
  const engine = useRef<Engine | null>(null)
  const [cur, setCur] = useState(0)
  const N = sheets.length
  const LAST = N - 1

  useEffect(() => {
    const pad = padRef.current
    const leaves = leafRefs.current.slice(0, N).filter((l): l is HTMLDivElement => !!l)
    if (!pad || leaves.length !== N) return
    const ang = new Float32Array(N) // 0 = lying on the pad, 180 = turned over the top
    let at = 0 // leaf on top
    let drag: { x: number; y: number; i: number | null; axis: 'x' | 'y'; dir: 'fwd' | 'back'; v: number; lp: number; lt: number } | null = null
    let off: (() => void) | null = null
    let last = 0
    const target = (i: number) => (i < at ? 180 : 0)

    type Curl = { root: HTMLElement; segs: HTMLElement[]; lits: HTMLElement[][]; slices: HTMLElement[][] }
    const curls = new Map<number, Curl>()
    const buildCurl = (i: number): Curl => {
      const have = curls.get(i)
      if (have) return have
      const el = leaves[i]!
      const fr = el.querySelector<HTMLElement>(':scope > .np-face.front')!
      const bk = el.querySelector<HTMLElement>(':scope > .np-face.back')!
      const host = el.querySelector<HTMLElement>(':scope > .np-curl-host')!
      const W = pad.offsetWidth
      const H = h
      const sh = H / SEG
      // copies of the page for each strip; a video becomes its poster frame while the page turns
      const html = fr.innerHTML
        .replace(/<video[^>]*poster="([^"]+)"[^>]*>(<\/video>)?/g, '<img class="ph" src="$1" alt="">')
        .replace(/<video[^>]*>(<\/video>)?/g, '<div class="ph"></div>') // no poster: a plain card while turning
        .replace(/<div class="np-(under|shade)"[^>]*><\/div>/g, '')
      const root = document.createElement('div')
      root.className = 'np-curl'
      let parent: HTMLElement = root
      const segs: HTMLElement[] = []
      for (let k = 0; k < SEG; k++) {
        const seg = document.createElement('div')
        seg.className = 'np-seg'
        seg.style.height = `${sh}px`
        seg.innerHTML =
          `<div class="np-slice f"><div class="${fr.className}" style="top:${-k * sh}px;height:${H}px;width:${W}px">${html}</div><div class="lit"></div></div>` +
          `<div class="np-slice b"><div class="${bk.className}" style="top:${-(SEG - 1 - k) * sh}px;height:${H}px;width:${W}px"></div><div class="lit"></div></div>`
        parent.appendChild(seg)
        segs.push(seg)
        parent = seg
      }
      host.appendChild(root)
      const c: Curl = {
        root,
        segs,
        lits: segs.map((s) => [...s.querySelectorAll<HTMLElement>(':scope > .np-slice > .lit')]),
        slices: segs.map((s) => [...s.querySelectorAll<HTMLElement>(':scope > .np-slice')]),
      }
      curls.set(i, c)
      return c
    }
    const dropCurl = (i: number) => {
      curls.get(i)?.root.remove()
      curls.delete(i)
    }

    const paint = (i: number) => {
      const a = ang[i] ?? 0
      const el = leaves[i]!
      const flat = a <= 0.01 || a >= 179.99
      el.style.zIndex = String(a > 90 ? N + 5 + i : N - i) // past upright it lies over the pad and over earlier turned leaves
      el.style.visibility = a >= 179.99 ? 'hidden' : 'visible'
      for (const f of el.querySelectorAll<HTMLElement>(':scope > .np-face')) f.style.visibility = flat ? '' : 'hidden'
      if (flat) dropCurl(i)
      else {
        const c = buildCurl(i)
        const B = BEND * Math.sin((a * Math.PI) / 180)
        const step = B / (SEG - 1)
        // past ~100deg the leaf is above the pad, toward the top of the screen: fade it out (per slice — opacity on
        // a 3D parent would flatten it and show the front mirrored through the back)
        const o = a < 100 ? '' : String(Math.max(0, 1 - (a - 100) / 60))
        let abs = a - B * 0.4
        c.segs.forEach((s, k) => {
          if (k > 0) abs += step
          s.style.transform = `rotateX(${k === 0 ? abs : step}deg)`
          const [front, backLit] = c.lits[k] ?? []
          // the front darkens as its strip tips away from the light; the back starts dark and brightens
          if (front) front.style.opacity = String(Math.min(0.55, Math.max(0, (abs / 90) * 0.45)))
          if (backLit) backLit.style.opacity = String(Math.min(0.5, Math.max(0, ((180 - abs) / 90) * 0.35)))
          for (const x of c.slices[k] ?? []) x.style.opacity = o
        })
      }
      const under = leaves[i + 1]?.querySelector<HTMLElement>('.np-under')
      if (under) under.style.opacity = a > 0 && a < 180 ? String(Math.sin((a * Math.PI) / 180) * 0.8) : '0'
    }

    // one frame job while anything moves; it removes itself when every leaf is at rest
    const tick = (t: number) => {
      const dt = Math.min(50, last ? t - last : 16)
      last = t
      let busy = !!drag
      for (let i = 0; i < N; i++) {
        if (drag?.i === i) continue // the finger owns this one
        const to = target(i)
        const d = to - (ang[i] ?? 0)
        if (d === 0) continue
        // ease out, with a floor on speed so the tail doesn't crawl
        const s = Math.sign(d) * Math.max(Math.abs(d) * (1 - Math.exp(-dt / 95)), dt * 0.12)
        ang[i] = Math.abs(s) >= Math.abs(d) ? to : (ang[i] ?? 0) + s
        paint(i)
        if (ang[i] !== to) busy = true
      }
      if (!busy && off) {
        off()
        off = null
        last = 0
      }
    }
    const run = () => {
      if (!off) off = onFrame({ write: ({ t }) => tick(t) })
    }
    const go = (n: number) => {
      at = Math.max(0, Math.min(LAST, n))
      setCur(at)
      if (calm) {
        for (let i = 0; i < N; i++) {
          ang[i] = target(i)
          paint(i)
        }
      } else run()
    }
    engine.current = { next: () => go(at + 1), prev: () => go(at - 1) }
    leaves.forEach((_, i) => paint(i))

    const down = (e: PointerEvent) => {
      if ((e.target as Element).closest('a,button')) return
      drag = { x: e.clientX, y: e.clientY, i: null, axis: 'y', dir: 'fwd', v: 0, lp: 0, lt: performance.now() }
      pad.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!drag) return
      const dx = e.clientX - drag.x
      const dy = e.clientY - drag.y
      if (drag.i === null) {
        if (Math.hypot(dx, dy) < 8) return
        drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
        const d0 = drag.axis === 'x' ? dx : dy // negative = up / left = forward
        if (d0 < 0 && at < LAST) Object.assign(drag, { i: at, dir: 'fwd' })
        else if (d0 > 0 && at > 0) Object.assign(drag, { i: at - 1, dir: 'back' })
        else {
          drag = null
          return
        }
      }
      const d = drag.axis === 'x' ? dx : dy
      const span = drag.axis === 'x' ? pad.offsetWidth * 0.8 : h * 0.75
      const f = Math.min(1, Math.abs(d) / span)
      ang[drag.i!] = drag.dir === 'fwd' ? f * 180 : 180 - f * 180
      const now = performance.now()
      drag.v = (d - drag.lp) / Math.max(1, now - drag.lt)
      drag.lp = d
      drag.lt = now
      paint(drag.i!)
    }
    const up = () => {
      if (!drag) return
      const g = drag
      drag = null
      if (g.i === null) return
      const a = ang[g.i] ?? 0
      const flick = Math.abs(g.v) > 0.5
      if (g.dir === 'fwd') go(a > 70 || (flick && g.v < 0) ? g.i + 1 : at)
      else go(a < 110 || (flick && g.v > 0) ? g.i : at)
      run()
    }
    pad.addEventListener('pointerdown', down)
    pad.addEventListener('pointermove', move)
    pad.addEventListener('pointerup', up)
    pad.addEventListener('pointercancel', up)
    const opener = autoOpen ? window.setTimeout(() => go(1), 900) : 0
    return () => {
      clearTimeout(opener)
      off?.()
      pad.removeEventListener('pointerdown', down)
      pad.removeEventListener('pointermove', move)
      pad.removeEventListener('pointerup', up)
      pad.removeEventListener('pointercancel', up)
      curls.forEach((_, i) => dropCurl(i))
      engine.current = null
    }
  }, [N, LAST, h, autoOpen])

  // only the page on top plays its video
  useEffect(() => {
    leafRefs.current.forEach((leaf, i) =>
      leaf?.querySelectorAll('video').forEach((v) => {
        if (i === cur) void v.play().catch(() => {})
        else v.pause()
      }),
    )
  }, [cur])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') engine.current?.next()
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') engine.current?.prev()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  const label = cur === 0 ? 'ปกหน้า' : cur === LAST ? 'ปกหลัง' : `หน้า ${cur} / ${N - 2}`
  // the stack of paper under the top leaf; a closed pad (either cover) shows none
  const stack = cur === 0 || cur >= LAST - 1 ? 0 : Math.min(8, 2 + LAST - cur)

  return (
    <div className="book-page notepad">
      {back}
      <p className="book-hint">{hint}</p>
      <div ref={padRef} className="np" style={{ width: w, ...(vtName ? { viewTransitionName: vtName } : null) }}>
        <div className="np-rings" aria-hidden="true" />
        <div className="np-stack" style={{ width: w, height: h }}>
          <div className="np-edges" style={{ '--t': `${stack}px` } as CSSProperties} />
          {sheets.map((s, i) => (
            <div
              key={i}
              className="np-leaf"
              ref={(el) => {
                leafRefs.current[i] = el
              }}
            >
              <div className={`np-face front ${s.kind === 'paper' ? 'paper' : 'board'}`}>
                <div className={s.center || s.kind !== 'paper' ? 'np-in center' : 'np-in'} dangerouslySetInnerHTML={{ __html: s.html }} />
                <div className="np-under" />
                <div className="np-shade" />
              </div>
              <div className={`np-face back ${s.kind === 'paper' ? 'paper' : 'board'}`} />
              <div className="np-curl-host" />
            </div>
          ))}
        </div>
      </div>
      <nav className="book-nav" aria-label="พลิกหน้า">
        <button type="button" aria-label="หน้าก่อน" disabled={cur === 0} onClick={() => engine.current?.prev()}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 19V5M5 12l7 7 7-7" />
          </svg>
        </button>
        <span className="count">{label}</span>
        <button type="button" aria-label="หน้าถัดไป" disabled={cur === LAST} onClick={() => engine.current?.next()}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12l7-7 7 7" />
          </svg>
        </button>
      </nav>
    </div>
  )
}
