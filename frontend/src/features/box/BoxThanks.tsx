import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { fullName, lineChatUrl, priceLabel, type CareTip, type MenuData } from '@/api/menu'
import boxPhoto from '@/assets/box-4.jpg'
import { JuneLogo } from '@/components/JuneLogo'
import { Drips } from '../home/Drips'
import '../home/home.css'
import './box.css'

const ICONS: Record<CareTip['icon'], ReactNode> = {
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  fridge: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path d="M6 10h12M9 6v1M9 13v3" />
    </>
  ),
  warm: (
    <>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
}

const chevron = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="m9 6 6 6-6 6" />
  </svg>
)

/**
 * The page the QR sticker on the box opens (mock/box-qr.html): thanks, "order again" on LINE, how to keep the cake
 * soft, add friend / send a photo. Same motion as the landing page: the June logo's palm opens and sways, the green
 * header drips into the cream, and each card fades up as it scrolls in.
 */
export function BoxThanks({ data }: { data: MenuData }) {
  const { products, line, shop, care } = data
  const product = products[0]
  const name = product ? fullName(product) : 'ขนมของ June'

  useEffect(() => {
    document.title = 'ขอบคุณที่อุดหนุน · June'
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('in')
          else if (e.boundingClientRect.top > innerHeight) e.target.classList.remove('in')
        }),
      { rootMargin: '0px 0px -8% 0px' },
    )
    document.querySelectorAll('.bx .reveal').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  const i = (n: number) => ({ '--i': n }) as CSSProperties
  return (
    <main className="bx">
      <header className="bx-head">
        <JuneLogo className="logo go" role="img" aria-label="June" aria-hidden={false} />
        <h1>ขอบคุณที่อุดหนุนนะคะ</h1>
        <p className="sub">หวังว่าจะอร่อย ทานให้สนุก</p>
      </header>

      <div className="bx-body">
        <Drips count={12} color="#3e5d58" />
        <section className="bx-card again reveal">
          <img src={boxPhoto} alt="ชิฟฟ่อน 4 ชิ้นในกล่อง" width={449} height={494} />
          <div>
            <h2>{name}</h2>
            {product && (
              <p className="pr">
                {priceLabel(product)}
                {product.price != null && product.priceUnit && ` · ${product.priceUnit}`}
              </p>
            )}
            <a className="bx-btn" href={lineChatUrl(line.oaId, `สนใจสั่ง ${name} อีกรอบ`)}>
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.5s5.9-3.5 8-6C21.4 14.2 22 12.7 22 11c0-4.4-4.5-8-10-8Z" />
              </svg>
              สั่งอีกรอบทาง LINE
            </a>
          </div>
        </section>

        {care.length > 0 && (
          <section className="bx-card tips">
            <h3 className="reveal">เก็บยังไงให้นุ่ม</h3>
            <ul>
              {care.map((t, k) => (
                <li key={k} className="reveal" style={i(k + 1)}>
                  <span className="ic" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {ICONS[t.icon]}
                    </svg>
                  </span>
                  <span>
                    {t.head && <b>{t.head}</b>}
                    {t.body}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="bx-card links reveal">
          <a href={line.addUrl}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="8" r="4" />
              <path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6" />
            </svg>
            <span>เพิ่มเพื่อน LINE รับข่าววันหยุด เมนูใหม่</span>
            {chevron}
          </a>
          <a href={lineChatUrl(line.oaId)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 8a2 2 0 0 1 2-2h2l2-3h6l2 3h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span>ถ่ายรูปส่งมาอวดกันหน่อย</span>
            {chevron}
          </a>
          <a href="/">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
            </svg>
            <span>ดูเว็บ June</span>
            {chevron}
          </a>
        </section>

        <p className="bx-foot reveal">
          หน้าร้าน June · {shop.address}
          {shop.hours && (
            <>
              <br />
              เวลาเปิด {shop.hours}
            </>
          )}
        </p>
      </div>
    </main>
  )
}
