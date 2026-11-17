import { viewportHeight } from './env'

/**
 * One requestAnimationFrame loop for the whole page (three.js skill: render-single-raf).
 *
 * Every job runs in three phases per frame so layout is computed once:
 *   read  – measure (getBoundingClientRect, offsetTop…) — never write styles here
 *   write – set styles / draw canvases from what was measured
 *   after – one more read+render pass for the 3D layer, which needs positions *after* this frame's writes
 * `scrolled` is false when neither scrollY nor the viewport height changed, so scroll-driven jobs can skip work.
 */
export interface FrameInfo {
  t: number
  y: number
  vh: number
  scrolled: boolean
}
export interface FrameJob {
  read?: (f: FrameInfo) => void
  write?: (f: FrameInfo) => void
  after?: (f: FrameInfo) => void
}

const jobs = new Set<FrameJob>()
let raf = 0
let lastY = Number.NaN
let lastVh = 0
let forced = true

function tick(t: number) {
  raf = requestAnimationFrame(tick)
  const y = scrollY
  const vh = viewportHeight()
  const f: FrameInfo = { t, y, vh, scrolled: forced || y !== lastY || vh !== lastVh }
  lastY = y
  lastVh = vh
  forced = false
  for (const j of jobs) j.read?.(f)
  for (const j of jobs) j.write?.(f)
  for (const j of jobs) j.after?.(f)
}

/** Register a job; returns the function that removes it. The loop stops when nothing is registered. */
export function onFrame(job: FrameJob): () => void {
  jobs.add(job)
  forced = true
  if (!raf) raf = requestAnimationFrame(tick)
  return () => {
    jobs.delete(job)
    if (!jobs.size && raf) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  }
}

/** Make the next frame treat everything as changed (e.g. a colour changed without scrolling). */
export function invalidateFrame() {
  forced = true
}

addEventListener('vhchange', invalidateFrame)
