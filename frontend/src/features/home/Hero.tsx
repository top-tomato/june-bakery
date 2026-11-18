import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { fullName, lineChatUrl, priceLabel, type Product } from '@/api/menu'
import { ChatIcon } from '@/components/icons'
import { JuneLogo } from '@/components/JuneLogo'
import { viewportHeight } from '@/lib/env'
import { introDelayMs } from './intro'
import type { HomeMotion } from './motion'

interface Props {
  products: Product[]
  active: number
  onPick: (i: number) => void
  /** "ดูใกล้ ๆ รอบชิ้น": jump to the story section; absent when the page has none */
  onOpen?: () => void
  spotRef: RefObject<HTMLDivElement | null>
  /** photo to show on the spot when there's no 3D for this cake */
  photo: string | null
  motion: RefObject<HomeMotion>
  lineOaId: string
}

/** the hero fills most of the screen (it may sit mid-page) */
const heroInView = () => {
  const r = document.getElementById('flavors')?.getBoundingClientRect()
  return !!r && r.top < viewportHeight() * 0.4 && r.bottom > viewportHeight() * 0.6
}

export function Hero({ products, active, onPick, onOpen, spotRef, photo, motion, lineOaId }: Props) {
  const product = products[active]
  const hasProduct = product !== undefined
  const logoRef = useRef<SVGSVGElement>(null)
  const [logoDelay] = useState(introDelayMs) // the palm opens as the curtain lifts; decided once, before the curtain marks itself played

  // the logo only sways while the hero is on screen
  useEffect(() => {
    const logo = logoRef.current
    if (!logo) return
    const io = new IntersectionObserver((entries) => logo.classList.toggle('paused', !entries[0]?.isIntersecting))
    io.observe(logo)
    return () => io.disconnect()
  }, [hasProduct])

  // arrow keys switch cakes while the hero is on screen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!heroInView()) return
      if (e.key === 'ArrowRight') onPick(active + 1)
      if (e.key === 'ArrowLeft') onPick(active - 1)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [active, onPick])

  // drag sideways anywhere in the hero to spin the cakes
  useEffect(() => {
    let down: number | null = null
    const start = (e: PointerEvent) => {
      if (heroInView() && !(e.target as Element).closest('button,a')) down = e.clientX
    }
    const move = (e: PointerEvent) => {
      if (down === null) return
      motion.current.dragX += (e.clientX - down) * 0.01
      down = e.clientX
    }
    const end = () => (down = null)
    addEventListener('pointerdown', start)
    addEventListener('pointermove', move, { passive: true })
    addEventListener('pointerup', end)
    return () => {
      removeEventListener('pointerdown', start)
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', end)
    }
  }, [motion])

  if (!product) return null
  return (
    <section className="hero" id="flavors" data-nav="light">
      <JuneLogo ref={logoRef} className="logo go" role="img" aria-label="June" aria-hidden={false} style={{ '--t0': `${logoDelay}ms` } as CSSProperties} />
      <h1>
        <span className="reveal">อบใหม่ หอม</span>
        <span className="reveal" style={{ '--i': 1 } as CSSProperties}>
          นุ่มนาน
        </span>
      </h1>
      <div ref={spotRef} className="hero-spot">
        {photo && <img className="cake-photo" src={photo} alt={fullName(product)} />}
      </div>
      <div className="edge l" />
      <div className="edge r" />
      {products.length > 1 && (
        <>
          <button type="button" className="arrow l" aria-label="เมนูก่อนหน้า" disabled={active === 0} onClick={() => onPick(active - 1)}>
            ←
          </button>
          <button
            type="button"
            className="arrow r"
            aria-label="เมนูถัดไป"
            disabled={active === products.length - 1}
            onClick={() => onPick(active + 1)}
          >
            →
          </button>
        </>
      )}
      <div className="pick">
        <h2 className="reveal" style={{ '--i': 2 } as CSSProperties}>
          {fullName(product)} <span className="price-chip">
            {priceLabel(product)}
            {product.price != null && product.priceUnit && <small>{product.priceUnit}</small>}
          </span>
        </h2>
        <p className="reveal" style={{ '--i': 3 } as CSSProperties}>
          {product.description}
        </p>
        <p className="hint">{products.length > 1 ? 'ลากเพื่อหมุนดู กดลูกศรเพื่อเปลี่ยนเมนู' : 'ลากเพื่อหมุนดูรอบชิ้น'}</p>
        <div className="ctas reveal" style={{ '--i': 4 } as CSSProperties}>
          <a className="btn" href={lineChatUrl(lineOaId, `สนใจสั่ง ${fullName(product)}`)} target="_blank" rel="noopener">
            <ChatIcon />
            สั่งทาง LINE
          </a>
          {onOpen && (
            <button type="button" className="btn ghost" onClick={onOpen}>
              ดูใกล้ ๆ รอบชิ้น
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
