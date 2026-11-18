import { useEffect, useRef, type RefObject } from 'react'
import { fullName, lineChatUrl, priceLabel, type Product } from '@/api/menu'
import { onFrame } from '@/lib/frame'
import { clamp, ease } from '@/lib/math'
import { Drips } from './Drips'
import type { HomeMotion } from './motion'

interface Props {
  product: Product
  lineOaId: string
  stageRef: RefObject<HTMLDivElement | null>
  /** the cake's photo when there is no 3D (shown in the stage instead of the box) */
  photo: string | null
  motion: RefObject<HomeMotion>
  above: string
}

/**
 * Pinned section after the story (mock/box-open.html): scrolling opens the box lid to show four pieces inside, then
 * the price ("฿120 กล่อง 4 ชิ้น") and the order button come up. The box itself is drawn by the cake layer's 3D scene
 * on top of `stageRef`; this section only writes its progress.
 */
export function Box({ product, lineOaId, stageRef, photo, motion, above }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current, pin = pinRef.current
    if (!section || !pin) return
    let top = 0, height = 0
    return onFrame({
      read: ({ scrolled }) => {
        if (!scrolled) return
        top = section.offsetTop
        height = section.offsetHeight
      },
      write: ({ scrolled, y, vh }) => {
        if (!scrolled) return
        const p = clamp((y - top) / (height - vh))
        motion.current.box.p = p
        pin.style.setProperty('--p', p.toFixed(3))
        pin.style.setProperty('--b', ease(clamp((p - 0.62) / 0.16)).toFixed(3))
      },
    })
  }, [motion])

  const unit = product.price != null && product.priceUnit
  return (
    <section ref={sectionRef} className="boxsec" id="box" data-nav="dark">
      <Drips count={22} color={above} />
      <div ref={pinRef} className="pin">
        <div ref={stageRef} className="box-stage">
          {photo && <img src={photo} alt="" />}
        </div>
        <div className="cap">
          <p className="hint">เปิดกล่องดูข้างใน</p>
          <div className="buy">
            <strong className={product.price == null ? 'ask' : undefined}>
              {priceLabel(product)}
              {unit && <small>{product.priceUnit}</small>}
            </strong>
            <a className="btn" href={lineChatUrl(lineOaId, `สนใจสั่ง ${fullName(product)}`)} target="_blank" rel="noopener">
              สั่งทาง LINE
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
