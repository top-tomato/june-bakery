export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
export const ease = (t: number) => t * t * (3 - 2 * t)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const rnd = (a: number, b: number) => a + Math.random() * (b - a)

/** CSS cubic-bezier(x1,y1,x2,y2) as a JS easing function, so canvas motion matches CSS keyframes. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 8; i++) {
      const dx = (3 * ax * t + 2 * bx) * t + cx
      if (Math.abs(dx) < 1e-6) break
      t -= (((ax * t + bx) * t + cx) * t - x) / dx
    }
    t = clamp(t)
    return ((ay * t + by) * t + cy) * t
  }
}
