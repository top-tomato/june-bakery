import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { JuneLogo } from '@/components/JuneLogo'
import { introDelayMs } from './intro'

/**
 * Opening screen of the preview/jemmy-order page (mock/opening.html, A): dark green, the big June logo like the old
 * hero, the tagline, and a "scroll" hint. The story ("เรื่องของ June") comes right after it.
 */
export function Opening() {
  const logoRef = useRef<SVGSVGElement>(null)
  const [logoDelay] = useState(introDelayMs) // the palm opens as the curtain lifts

  // the logo only sways while this screen is visible
  useEffect(() => {
    const logo = logoRef.current
    if (!logo) return
    const io = new IntersectionObserver((entries) => logo.classList.toggle('paused', !entries[0]?.isIntersecting))
    io.observe(logo)
    return () => io.disconnect()
  }, [])

  const t0 = { '--t0': `${logoDelay}ms` } as CSSProperties
  return (
    <section className="opening" id="opening" data-nav="light" style={t0}>
      <div>
        <JuneLogo ref={logoRef} className="logo go" role="img" aria-label="June" aria-hidden={false} style={t0} />
        <h1>
          <span>อบใหม่ หอม</span>
          <span>นุ่มนาน</span>
        </h1>
        <p className="sub">ชิฟฟ่อนมะพร้าวใบเตย ทำเองทุกชิ้น</p>
      </div>
      <p className="scroll" aria-hidden="true">
        เลื่อนลง
        <i />
      </p>
    </section>
  )
}
