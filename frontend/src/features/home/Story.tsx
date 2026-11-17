import { useEffect, useRef, type CSSProperties, type RefObject } from 'react'
import { fullName, lineChatUrl, priceLabel, type Product } from '@/api/menu'
import { calm } from '@/lib/env'
import { onFrame } from '@/lib/frame'
import { clamp, ease } from '@/lib/math'
import { Drips } from './Drips'
import type { HomeMotion } from './motion'

const INK = '#243B37'
const CALLOUT_POS = [
  { left: '84%', top: '20%' },
  { left: '93%', top: '48%' },
  { left: '82%', top: '76%' },
]

interface Props {
  product: Product
  lineOaId: string
  stageRef: RefObject<HTMLDivElement | null>
  photo: string | null
  motion: RefObject<HomeMotion>
}

/**
 * Pinned section: as you scroll through it the name slides up, the cake flies onto the plate and spins,
 * the highlights draw in, then price + order button. All driven from one frame job writing CSS variables.
 */
export function Story({ product, lineOaId, stageRef, photo, motion }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const bandRef = useRef<HTMLDivElement>(null)
  const callRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const section = sectionRef.current, pin = pinRef.current, band = bandRef.current
    if (!section || !pin || !band) return
    let top = 0, height = 0
    const off = onFrame({
      read: ({ scrolled }) => {
        if (!scrolled) return
        top = section.offsetTop
        height = section.offsetHeight
      },
      write: ({ scrolled, y, vh }) => {
        if (!scrolled) return
        const p = clamp((y - top) / (height - vh))
        const a = calm ? 1 : ease(clamp((y - top + vh * 0.5) / (vh * 0.9)))
        motion.current.story.a = a
        motion.current.story.p = p
        pin.style.setProperty('--a', a.toFixed(3))
        pin.style.setProperty('--e', ease(clamp((p - 0.74) / 0.14)).toFixed(3))
        callRefs.current.forEach((c, k) => c?.style.setProperty('--c', ease(clamp((p - 0.46 - k * 0.08) / 0.12)).toFixed(3)))
        band.style.transform = `translateX(${-5 - p * 28}%)`
      },
    })
    return off
  }, [motion])

  const style = { '--fl': product.accent, '--fink': INK } as CSSProperties
  return (
    <section ref={sectionRef} className="story" id="story" data-nav="dark" style={style}>
      <Drips count={22} />
      <div ref={pinRef} className="pin">
        <div>
          <h2>
            <span className="ln">
              <b>{product.name[0]}</b>
            </span>
            <span className="ln">
              <b>{product.name[1]}</b>
            </span>
          </h2>
          <p className="desc">{product.description}</p>
          <div className="buy">
            <strong className={product.price == null ? 'ask' : undefined}>{priceLabel(product)}</strong>
            <a className="btn" href={lineChatUrl(lineOaId, `สนใจสั่ง ${fullName(product)}`)} target="_blank" rel="noopener">
              สั่งทาง LINE
            </a>
          </div>
        </div>
        <div className="stagewrap">
          <div ref={stageRef} className="stage">
            {photo && <img className="cake-photo" src={photo} alt="" />}
            {product.highlights.map((h, k) => (
              <div key={k} ref={(el) => void (callRefs.current[k] = el)} className="call" style={CALLOUT_POS[k]}>
                <i />
                <span>{h}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="band" aria-hidden="true">
          <div ref={bandRef}>{`${fullName(product)}  ●  `.repeat(14)}</div>
        </div>
      </div>
    </section>
  )
}
