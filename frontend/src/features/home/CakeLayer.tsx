import { useEffect, useRef, type RefObject } from 'react'
import { debug, hasWebGL } from '@/lib/env'
import type { HomeMotion } from './motion'

interface Props {
  models: string[]
  heroSpot: RefObject<HTMLDivElement | null>
  stage: RefObject<HTMLDivElement | null>
  boxStage: RefObject<HTMLDivElement | null>
  motion: RefObject<HomeMotion>
  /** 'all' = no 3D at all (show photos), a number = that cake's model failed */
  onFail: (what: 'all' | number) => void
  /** the 3D arrived after the photos had already taken over (slow first load): switch back to 3D */
  onLate: () => void
}

/**
 * Mounts the three.js scene. three.js is loaded as a separate chunk after the page is up
 * (react skill: bundle-conditional / bundle-dynamic-imports), so the first paint doesn't wait for it.
 */
const LAYER = { position: 'fixed', left: 0, top: 0, width: '100%', height: 'var(--vhmax)' } as const

export function CakeLayer({ models, heroSpot, stage, boxStage, motion, onFail, onLate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // keep the latest callback without restarting the scene (react skill: advanced-event-handler-refs)
  const onFailRef = useRef(onFail)
  const onLateRef = useRef(onLate)
  useEffect(() => {
    onFailRef.current = onFail
    onLateRef.current = onLate
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !heroSpot.current || !stage.current || !boxStage.current) return
    if (debug.no3d || !hasWebGL) {
      onFailRef.current('all')
      return
    }
    let dispose: (() => void) | undefined
    let cancelled = false
    // no scene within 4.5 s (slow network, blocked script): show photos instead
    // (the site's server sleeps when idle, so a first visit can take longer; if the 3D still arrives, it takes over again)
    let late = false
    const giveUp = setTimeout(() => {
      late = true
      onFailRef.current('all')
    }, 4500)
    import('./three/cakeScene')
      .then(({ createCakeScene }) => {
        if (cancelled || !heroSpot.current || !stage.current || !boxStage.current) return
        clearTimeout(giveUp)
        dispose = createCakeScene({
          canvas,
          models,
          heroSpot: heroSpot.current,
          stage: stage.current,
          story: motion.current.story,
          boxStage: boxStage.current,
          box: motion.current.box,
          active: () => motion.current.active,
          dragX: () => motion.current.dragX,
          introAt: motion.current.introAt,
          onModelError: (i) => onFailRef.current(i),
        })
        if (late) onLateRef.current()
      })
      .catch(() => onFailRef.current('all'))
    return () => {
      cancelled = true
      clearTimeout(giveUp)
      dispose?.()
    }
  }, [models, heroSpot, stage, boxStage, motion])

  // size inline as well as in home.css, so it is right even if the 3D starts before that stylesheet applies
  return <canvas ref={canvasRef} className="cake-layer" style={LAYER} aria-hidden="true" />
}
