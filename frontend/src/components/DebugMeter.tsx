import { useEffect, useRef } from 'react'
import { debug } from '@/lib/env'
import { onFrame } from '@/lib/frame'

/**
 * Frame meter for testing on a real phone (?fps). With ?log (or when opened from the dev server over Wi-Fi) it also
 * sends each second's numbers to the dev server, where they show up in the runserver log as GET /__dbg?...
 */
export function DebugMeter() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!debug.fps) return
    const send = (q: string) => {
      if (debug.log) fetch(`/__dbg?${q}`, { keepalive: true }).catch(() => {})
    }
    send(`ua=${encodeURIComponent(navigator.userAgent)}&dpr=${devicePixelRatio}&w=${innerWidth}&h=${innerHeight}`)

    let n = 0, worst = 0, slow = 0, resizes = 0, moved = 0, maxStep = 0
    let last = performance.now(), t0 = last, lastY = scrollY
    const onResize = () => resizes++
    addEventListener('resize', onResize)
    const off = onFrame({
      write: ({ t, y }) => {
        const d = t - last
        last = t
        n++
        worst = Math.max(worst, d)
        if (d > 25) slow++
        const dy = Math.abs(y - lastY)
        lastY = y
        if (dy) moved++
        maxStep = Math.max(maxStep, dy)
        if (t - t0 < 1000) return
        const fps = Math.round((n * 1000) / (t - t0))
        const section = document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest('section')?.id ?? '-'
        send(`fps=${fps}&worst=${Math.round(worst)}&slow=${slow}&y=${Math.round(y)}&sec=${section}&moved=${moved}&maxStep=${maxStep}&resizes=${resizes}&ih=${innerHeight}`)
        if (ref.current) ref.current.textContent = `${fps} fps\nช้าสุด ${Math.round(worst)} ms\nสะดุด ${slow} ครั้ง`
        n = worst = slow = resizes = moved = maxStep = 0
        t0 = t
      },
    })
    return () => {
      off()
      removeEventListener('resize', onResize)
    }
  }, [])

  return debug.fps ? <div ref={ref} className="dbg-meter" aria-hidden="true" /> : null
}
