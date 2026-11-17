import { useEffect, useRef, type RefObject } from 'react'
import { debug, hasWebGL } from '@/lib/env'
import type { HomeMotion } from './motion'

interface Props {
  models: string[]
  heroSpot: RefObject<HTMLDivElement | null>
  stage: RefObject<HTMLDivElement | null>
  motion: RefObject<HomeMotion>
  /** 'all' = no 3D at all (show photos), a number = that cake's model failed */
  onFail: (what: 'all' | number) => void
}

/**
 * Mounts the three.js scene. three.js is loaded as a separate chunk after the page is up
 * (react skill: bundle-conditional / bundle-dynamic-imports), so the first paint doesn't wait for it.
 */
export function CakeLayer({ models, heroSpot, stage, motion, onFail }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // keep the latest callback without restarting the scene (react skill: advanced-event-handler-refs)
  const onFailRef = useRef(onFail)
  useEffect(() => {
    onFailRef.current = onFail
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !heroSpot.current || !stage.current) return
    if (debug.no3d || !hasWebGL) {
      onFailRef.current('all')
      return
    }
    let dispose: (() => void) | undefined
    let cancelled = false
    // no scene within 4.5 s (slow network, blocked script): show photos instead
    const giveUp = setTimeout(() => onFailRef.current('all'), 4500)
    import('./three/cakeScene')
      .then(({ createCakeScene }) => {
        if (cancelled || !heroSpot.current || !stage.current) return
        clearTimeout(giveUp)
        dispose = createCakeScene({
          canvas,
          models,
          heroSpot: heroSpot.current,
          stage: stage.current,
          story: motion.current.story,
          active: () => motion.current.active,
          dragX: () => motion.current.dragX,
          introAt: motion.current.introAt,
          onModelError: (i) => onFailRef.current(i),
        })
      })
      .catch(() => onFailRef.current('all'))
    return () => {
      cancelled = true
      clearTimeout(giveUp)
      dispose?.()
    }
  }, [models, heroSpot, stage, motion])

  return <canvas ref={canvasRef} className="cake-layer" aria-hidden="true" />
}
