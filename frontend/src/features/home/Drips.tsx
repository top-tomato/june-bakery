import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { hasWebGL } from '@/lib/env'
import { invalidateFrame, onFrame } from '@/lib/frame'
import { clamp, ease } from '@/lib/math'
import { createDripRenderer, cssColorToRgb, makeDrips, type DripRenderer } from './gl/drips'

/**
 * Cream drips hanging from the top of a section; they stretch as the section scrolls in.
 * Colour comes from the section's --from (what is above it), or `color` when the section above changes colour.
 *
 * Each strip holds a WebGL context only while it is near the screen: phones keep just a few contexts alive and drop
 * the oldest (that was the cake/box layer) once a long scroll has woken every strip. Off screen the strip's canvas is
 * removed and its context released; coming back makes a fresh canvas (a lost context can't be reused on the old one).
 */
export function Drips({ count, color }: { count: number; color?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [drips] = useState(() => makeDrips(count))
  const [fallback, setFallback] = useState(!hasWebGL)
  // colour is read from CSS once and cached; a new `color` only clears the cache (no new WebGL context)
  const rgb = useRef<number[] | null>(null)
  useEffect(() => {
    rgb.current = null
    invalidateFrame()
  }, [color])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let renderer: DripRenderer | null = null, canvas: HTMLCanvasElement | null = null
    const release = () => {
      renderer?.dispose()
      canvas?.remove()
      renderer = null
      canvas = null
    }
    let top = 0, on = false, W = 0, H = 0
    const off = onFrame({
      read: ({ scrolled, vh }) => {
        if (!scrolled) return
        top = el.parentElement?.getBoundingClientRect().top ?? 0
        on = top < vh + 50 && top > -400
        if (!on || fallback) return
        W = el.clientWidth
        H = el.clientHeight
        rgb.current ??= cssColorToRgb(getComputedStyle(el).color)
      },
      write: ({ scrolled, vh }) => {
        if (!scrolled) return
        if (!on) return release()
        const g = 0.2 + 0.8 * ease(clamp((vh - top) / (vh * 0.85)))
        if (fallback) {
          el.style.setProperty('--g', g.toFixed(3))
          return
        }
        // set up WebGL the first time this strip comes into view
        if (!renderer) {
          canvas = document.createElement('canvas')
          el.append(canvas)
          renderer = createDripRenderer(canvas, drips)
          if (!renderer) {
            release()
            return setFallback(true)
          }
        }
        if (renderer && rgb.current) renderer.draw(g, W, H, rgb.current)
      },
    })
    return () => {
      off()
      release()
    }
  }, [drips, fallback])

  const style = color ? ({ color } as CSSProperties) : undefined
  return (
    <div ref={ref} className={fallback ? 'drips fallback' : 'drips'} style={style} aria-hidden="true">
      {/* the WebGL canvas is added and removed by the frame job above */}
      {fallback &&
        drips.map((q, i) => (
          <div
            key={i}
            className="drip"
            style={{ left: `${q.left.toFixed(2)}%`, width: q.w, '--len': `${q.len}px` } as CSSProperties}
          />
        ))}
    </div>
  )
}

/** SVG filter used only by the no-WebGL fallback drips. */
export function GooFilter() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <filter id="goo">
        <feGaussianBlur in="SourceGraphic" stdDeviation="8" />
        <feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 24 -10" />
      </filter>
    </svg>
  )
}
