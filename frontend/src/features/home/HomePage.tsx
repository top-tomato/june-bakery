import './home.css'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { MenuData } from '@/api/menu'
import { calm, viewportHeight } from '@/lib/env'
import { invalidateFrame } from '@/lib/frame'
import { clamp } from '@/lib/math'
import { CakeLayer } from './CakeLayer'
import { Curtain } from './Curtain'
import { GooFilter } from './Drips'
import { End } from './End'
import { Hero } from './Hero'
import { createMotion, type HomeMotion } from './motion'
import { Nav } from './Nav'
import { Story } from './Story'
import { Where } from './Where'

export function HomePage({ data }: { data: MenuData }) {
  const { products, line, shop } = data
  const [active, setActive] = useState(0)
  // 3D failures: 'all' = no 3D at all, otherwise the indexes whose model failed
  const [noGl, setNoGl] = useState<'all' | Set<number>>(() => new Set())
  // per-frame values shared with the 3D scene; a ref so updating them never re-renders
  const motion = useRef<HomeMotion>(createMotion())
  const heroSpot = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)

  const pick = useCallback(
    (i: number) => {
      const next = clamp(i, 0, products.length - 1)
      motion.current.active = next
      setActive(next)
      invalidateFrame() // the drips under the story change colour
    },
    [motion, products.length],
  )

  const openStory = useCallback(() => {
    const story = document.getElementById('story')
    if (story) scrollTo({ top: story.offsetTop + viewportHeight() * 0.9, behavior: calm ? 'auto' : 'smooth' })
  }, [])

  const onFail = useCallback((what: 'all' | number) => {
    setNoGl((prev) => (what === 'all' || prev === 'all' ? 'all' : new Set(prev).add(what)))
  }, [])

  const models = useMemo(() => products.map((p) => p.model), [products])
  const product = products[active]
  if (!product) {
    return (
      <main className="plain-page">
        <h1>June กำลังเตรียมเมนู</h1>
        <a className="btn" href={line.addUrl}>
          ทักถามทาง LINE
        </a>
      </main>
    )
  }
  const photo = !product.model || noGl === 'all' || noGl.has(active) ? product.image : null

  return (
    <>
      <GooFilter />
      <CakeLayer models={models} heroSpot={heroSpot} stage={stage} motion={motion} onFail={onFail} />
      <Curtain />
      <Nav />
      <main>
        <Hero products={products} active={active} onPick={pick} onOpen={openStory} spotRef={heroSpot} photo={photo} motion={motion} />
        <Story product={product} lineOaId={line.oaId} stageRef={stage} photo={photo} motion={motion} />
        <Where shop={shop} above={product.accent} />
        <End line={line} social={data.social} />
      </main>
    </>
  )
}
