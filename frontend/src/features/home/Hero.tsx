import { useEffect, type CSSProperties, type RefObject } from 'react'
import { fullName, type Product } from '@/api/menu'
import { viewportHeight } from '@/lib/env'
import type { HomeMotion } from './motion'

interface Props {
  products: Product[]
  active: number
  onPick: (i: number) => void
  spotRef: RefObject<HTMLDivElement | null>
  /** photo to show on the spot when there's no 3D for this cake */
  photo: string | null
  motion: RefObject<HomeMotion>
}

/** the hero fills most of the screen (it sits mid-page) */
const heroInView = () => {
  const r = document.getElementById('flavors')?.getBoundingClientRect()
  return !!r && r.top < viewportHeight() * 0.4 && r.bottom > viewportHeight() * 0.6
}

/**
 * The cake, mid-page on dark green (mock/hero-detail.html, preview/jemmy-order): the story section's details moved
 * here: big name, description, the 3D cake (no plate) on `spotRef`, the highlights as small labels, and the name band.
 * No price or order button (those are in the box section next). The cake's drop-in entrance is in three/cakeScene.ts.
 */
export function Hero({ products, active, onPick, spotRef, photo, motion }: Props) {
  const product = products[active]

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

  // drag sideways anywhere in the hero to spin the cake
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
  const i = (n: number) => ({ '--i': n }) as CSSProperties
  return (
    <section className="hero detail" id="flavors" data-nav="light">
      <div className="hd-txt">
        <p className="hd-tag reveal">อบใหม่ หอม นุ่มนาน</p>
        <h2 className="hd-name">
          <span className="reveal" style={i(1)}>
            {product.name[0]}
          </span>
          <span className="reveal" style={i(2)}>
            {product.name[1]}
          </span>
        </h2>
        <p className="hd-desc reveal" style={i(3)}>
          {product.description}
        </p>
      </div>
      <div className="hd-stage">
        <div ref={spotRef} className="hd-spot">
          {photo && <img className="cake-photo" src={photo} alt={fullName(product)} />}
        </div>
      </div>
      {product.highlights.length > 0 && (
        <ul className="hd-calls">
          {product.highlights.map((h, k) => (
            // after the cake has landed (~0.9 s)
            <li key={k} className="reveal" style={i(9 + k * 2)}>
              {h}
            </li>
          ))}
        </ul>
      )}
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
      <div className="hd-band" aria-hidden="true">
        <div>{`${fullName(product)}  ●  `.repeat(14)}</div>
      </div>
    </section>
  )
}
