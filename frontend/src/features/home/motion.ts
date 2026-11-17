/**
 * Values that change every frame and are shared between sections and the 3D scene.
 * A plain mutable object, never React state (react skill: rerender-use-ref-transient-values) — updating it must not
 * re-render anything.
 */
export interface HomeMotion {
  story: { a: number; p: number }
  active: number
  dragX: number
  startedAt: number
}

export const createMotion = (): HomeMotion => ({
  story: { a: 0, p: 0 },
  active: 0,
  dragX: 0,
  startedAt: performance.now(),
})
