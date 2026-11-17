import { useEffect, useRef, useState } from 'react'
import { calm } from '@/lib/env'
import { onFrame } from '@/lib/frame'
import { clamp } from '@/lib/math'
import { CURTAIN_MS, createCurtain } from './gl/curtain'

const COUNT_MS = 850

/** Cream curtain + "June" logo filling up 0–100% while the page starts. Removes itself when done. */
export function Curtain() {
  const [done, setDone] = useState(calm)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const countRef = useRef<HTMLDivElement>(null)
  const pctRef = useRef<HTMLSpanElement>(null)
  const fillRef = useRef<HTMLSpanElement>(null)
  const loadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (done) return
    const canvas = canvasRef.current
    if (!canvas) return
    const curtain = createCurtain(canvas)
    if (curtain) canvas.classList.add('gl')
    else canvas.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, delay: 1800, fill: 'forwards' }) // no WebGL

    const t0 = performance.now()
    const off = onFrame({
      write: ({ t }) => {
        const ms = t - t0
        curtain?.draw(ms)
        const p = clamp(ms / COUNT_MS)
        if (pctRef.current) pctRef.current.textContent = `${Math.round(p * 100)}%`
        if (fillRef.current) fillRef.current.style.clipPath = `inset(${(1 - p) * 100}% 0 0 0)`
        if (loadRef.current) loadRef.current.style.transform = `translateY(${Math.sin(ms / 180) * 2}px)`
        if (p >= 1 && countRef.current) countRef.current.style.opacity = '0'
      },
    })
    const timer = setTimeout(() => setDone(true), CURTAIN_MS)
    return () => {
      off()
      clearTimeout(timer)
      curtain?.dispose()
    }
  }, [done])

  if (done) return null
  return (
    <>
      <canvas ref={canvasRef} className="curtain" aria-hidden="true" />
      <div ref={countRef} className="count" aria-hidden="true">
        <div ref={loadRef} className="load">
          <span className="logo-mask ghost" />
          <span ref={fillRef} className="logo-mask fill" />
        </div>
        <span ref={pctRef}>0%</span>
      </div>
    </>
  )
}
