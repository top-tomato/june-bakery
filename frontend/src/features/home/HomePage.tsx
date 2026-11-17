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
import { About, Gallery, Reviews } from './Extras'
import { HowToOrder } from './HowToOrder'
import { Hero } from './Hero'
import { createMotion, type HomeMotion } from './motion'
import { Nav } from './Nav'
import { Story } from './Story'
import { Where } from './Where'

const BG = { indigo: '#3E5D58', pink: '#DCEBB5', cream: '#FFF6E6' }

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

  // Section backgrounds, top to bottom. Optional sections only appear once filled in (admin), and each section's
  // drips take the colour of whatever is visible right above it.
  const sections: { key: string; bg: string }[] = [{ key: 'story', bg: product.accent }, { key: 'how', bg: BG.pink }]
  if (data.reviews.length) sections.push({ key: 'reviews', bg: BG.indigo })
  if (data.about) sections.push({ key: 'about', bg: BG.cream })
  if (data.gallery.length) sections.push({ key: 'gallery', bg: BG.cream })
  const above = (key: string) => sections[sections.findIndex((s) => s.key === key) - 1]?.bg ?? BG.indigo
  const lastBg = sections[sections.length - 1]?.bg ?? BG.indigo

  return (
    <>
      <GooFilter />
      <CakeLayer models={models} heroSpot={heroSpot} stage={stage} motion={motion} onFail={onFail} />
      <Curtain />
      <Nav />
      <main>
        <Hero products={products} active={active} onPick={pick} onOpen={openStory} spotRef={heroSpot} photo={photo} motion={motion} lineOaId={line.oaId} />
        <Story product={product} lineOaId={line.oaId} stageRef={stage} photo={photo} motion={motion} />
        <HowToOrder order={data.order} shopName={shop.name} above={above('how')} />
        {data.reviews.length > 0 && <Reviews reviews={data.reviews} above={above('reviews')} />}
        {data.about && <About about={data.about} above={above('about')} />}
        {data.gallery.length > 0 && <Gallery photos={data.gallery} above={above('gallery')} />}
        <Where shop={shop} closedDays={data.closedDays} above={lastBg} />
        <End line={line} social={data.social} />
      </main>
    </>
  )
}
