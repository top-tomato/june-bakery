import { useEffect, useRef, useState } from 'react'
import { JuneLogo } from '@/components/JuneLogo'
import { onFrame } from '@/lib/frame'
import { clamp } from '@/lib/math'
import { CURTAIN_MS, createCurtain } from './gl/curtain'
import { CURTAIN_HOLD_MS, curtainWillPlay, markCurtainPlayed } from './intro'

/** the count runs as long as the logo takes to open (base.css `.june-logo.intro`) */
const COUNT_MS = 850 + CURTAIN_HOLD_MS

/** Cream curtain + "June" logo opening its palm leaves over a thin progress bar (mock/loading-bar.html, option A).
 * Removes itself when done. */
export function Curtain() {
  const [done, setDone] = useState(() => !curtainWillPlay())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const countRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLElement>(null)
  const loadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (done) return
    const canvas = canvasRef.current
    if (!canvas) return
    const curtain = createCurtain(canvas)
    if (curtain) canvas.classList.add('gl')
    else canvas.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, delay: 1800 + CURTAIN_HOLD_MS, fill: 'forwards' }) // no WebGL

    const t0 = performance.now()
    const off = onFrame({
      write: ({ t }) => {
        const ms = t - t0
        curtain?.draw(ms - CURTAIN_HOLD_MS)
        const p = clamp(ms / COUNT_MS)
        if (barRef.current) barRef.current.style.transform = `scaleX(${p})`
        if (loadRef.current) loadRef.current.style.transform = `translateY(${Math.sin(ms / 180) * 2}px)`
        if (p >= 1 && countRef.current) countRef.current.style.opacity = '0'
      },
    })
    markCurtainPlayed()
    const timer = setTimeout(() => setDone(true), CURTAIN_MS + CURTAIN_HOLD_MS)
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
      <div ref={countRef} className="intro-count" aria-hidden="true">
        <div ref={loadRef} className="load">
          <JuneLogo className="go intro" />
        </div>
        <span className="bar">
          <i ref={barRef} />
        </span>
      </div>
    </>
  )
}
