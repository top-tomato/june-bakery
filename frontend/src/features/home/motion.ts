import { cakeIntroDelayMs } from './intro'

/**
 * Values that change every frame and are shared between sections and the 3D scene.
 * A plain mutable object, never React state (react skill: rerender-use-ref-transient-values) — updating it must not
 * re-render anything.
 */
export interface HomeMotion {
  story: { a: number; p: number }
  /** progress through the box section's pinned part (0–1) */
  box: { p: number }
  active: number
  dragX: number
  /** when the cake's drop-in starts (performance.now() time) */
  introAt: number
}

export const createMotion = (): HomeMotion => ({
  story: { a: 0, p: 0 },
  box: { p: 0 },
  active: 0,
  dragX: 0,
  introAt: performance.now() + cakeIntroDelayMs(),
})
