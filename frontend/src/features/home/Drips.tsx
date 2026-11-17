import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { hasWebGL } from '@/lib/env'
import { invalidateFrame, onFrame } from '@/lib/frame'
import { clamp, ease } from '@/lib/math'
import { createDripRenderer, cssColorToRgb, makeDrips, type DripRenderer } from './gl/drips'

/**
 * Cream drips hanging from the top of a section; they stretch as the section scrolls in.
 * Colour comes from the section's --from (what is above it), or `color` when the section above changes colour.
 */
export function Drips({ count, color }: { count: number; color?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
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
    let renderer: DripRenderer | null = null
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
        if (!scrolled || !on) return
        const g = 0.2 + 0.8 * ease(clamp((vh - top) / (vh * 0.85)))
        if (fallback) {
          el.style.setProperty('--g', g.toFixed(3))
          return
        }
        // set up WebGL the first time this strip comes into view
        if (!renderer && canvasRef.current) {
          renderer = createDripRenderer(canvasRef.current, drips)
          if (!renderer) return setFallback(true)
        }
        if (renderer && rgb.current) renderer.draw(g, W, H, rgb.current)
      },
    })
    return () => {
      off()
      renderer?.dispose()
    }
  }, [drips, fallback])

  const style = color ? ({ color } as CSSProperties) : undefined
  return (
    <div ref={ref} className={fallback ? 'drips fallback' : 'drips'} style={style} aria-hidden="true">
      {fallback ? (
        drips.map((q, i) => (
          <div
            key={i}
            className="drip"
            style={{ left: `${q.left.toFixed(2)}%`, width: q.w, '--len': `${q.len}px` } as CSSProperties}
          />
        ))
      ) : (
        <canvas ref={canvasRef} />
      )}
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
