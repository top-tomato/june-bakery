import './home.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MenuData } from '@/api/menu'
import { invalidateFrame } from '@/lib/frame'
import { clamp } from '@/lib/math'
import { CakeLayer } from './CakeLayer'
import { Curtain } from './Curtain'
import { GooFilter } from './Drips'
import { End } from './End'
import { Box } from './Box'
import { About, Gallery } from './Extras'
import { Hero } from './Hero'
import { createMotion, type HomeMotion } from './motion'
import { Nav } from './Nav'
import { Opening } from './Opening'
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
  const boxStage = useRef<HTMLDivElement>(null)

  const pick = useCallback(
    (i: number) => {
      const next = clamp(i, 0, products.length - 1)
      motion.current.active = next
      setActive(next)
      invalidateFrame() // the drips under the story change colour
    },
    [motion, products.length],
  )


  const onLate = useCallback(() => setNoGl((prev) => (prev === 'all' ? new Set() : prev)), [])

  const onFail = useCallback((what: 'all' | number) => {
    setNoGl((prev) => (what === 'all' || prev === 'all' ? 'all' : new Set(prev).add(what)))
  }, [])

  // text fades up gently as its section scrolls in (.reveal in home.css); it plays again each time the section comes
  // back (preview/jemmy-order: "every section's text animates on scroll")
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('in')
          // reset only once well off screen (below), so it never flickers at the edge and replays on the way down
          else if (e.boundingClientRect.top > innerHeight) e.target.classList.remove('in')
        }),
      { rootMargin: '0px 0px -12% 0px' },
    )
    document.querySelectorAll('main .reveal').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [data])

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
  // Page order asked for in review (preview/jemmy-order): opening, about, gallery, hero, box, shop, end. No story or
  // how-to.
  const sections: { key: string; bg: string }[] = [{ key: 'opening', bg: BG.indigo }]
  if (data.about) sections.push({ key: 'about', bg: BG.cream })
  if (data.gallery.length) sections.push({ key: 'gallery', bg: BG.pink })
  sections.push({ key: 'hero', bg: BG.indigo }, { key: 'box', bg: BG.indigo })
  const above = (key: string) => sections[sections.findIndex((s) => s.key === key) - 1]?.bg ?? BG.indigo
  const flush = (key: string) => above(key) === sections.find((s) => s.key === key)?.bg
  const lastBg = sections[sections.length - 1]?.bg ?? BG.indigo

  return (
    <>
      <GooFilter />
      <CakeLayer models={models} heroSpot={heroSpot} stage={null} boxStage={boxStage} motion={motion} onFail={onFail} onLate={onLate} />
      <Curtain />
      <Nav />
      <main>
        <Opening />
        {data.about && <About about={data.about} above={above('about')} flush={flush('about')} />}
        {data.gallery.length > 0 && <Gallery photos={data.gallery} above={above('gallery')} flush={flush('gallery')} />}
        <Hero products={products} active={active} onPick={pick} spotRef={heroSpot} photo={photo} motion={motion} />
        <Box product={product} lineOaId={line.oaId} stageRef={boxStage} photo={photo} motion={motion} above={above('box')} flush={flush('box')} />
        <Where shop={shop} closedDays={data.closedDays} above={lastBg} />
        <End line={line} social={data.social} />
      </main>
    </>
  )
}
