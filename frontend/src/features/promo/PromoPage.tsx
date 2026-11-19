import { useEffect, useState, type CSSProperties } from 'react'
import { lineChatUrl, type MenuData } from '@/api/menu'
import { JuneLogo } from '@/components/JuneLogo'
import { Curtain } from '../home/Curtain'
import { introDelayMs } from '../home/intro'
import '../home/home.css'
import './promo.css'

const lineIcon = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.5s5.9-3.5 8-6C21.4 14.2 22 12.7 22 11c0-4.4-4.5-8-10-8Z" />
  </svg>
)

/**
 * The promotions showing today as a simple flyer to read (mock/promo.html A, mock/promo-list.html): the end date, the
 * heading the shop gave them ("ของขวัญปีใหม่", else "โปรโมชั่น"), one line per promo with its price, and a single
 * "order on LINE" button. No promo (none written, or past its end date) = a short note and
 * a chat button. Opening: the logo's palm sways, the sheet drops in like it's pinned to a board, the lines float up.
 */
export function PromoPage({ data }: { data: MenuData }) {
  const { promo, line } = data

  const [t0] = useState(introDelayMs) // decided once, before the curtain marks itself played
  const delay = { '--t0': `${t0}ms` } as CSSProperties

  const title = promo?.title ?? 'โปรโมชั่น'
  useEffect(() => {
    document.title = `${title} · June`
  }, [title])

  return (
    <main className="pm" style={delay}>
      <Curtain />
      <JuneLogo className="logo go" role="img" aria-label="June" aria-hidden={false} style={delay} />
      {promo ? (
        <article className="pm-sheet">
          {promo.until && <p className="pm-month">ถึง {promo.until}</p>}
          <h1>{promo.title}</h1>
          <ul>
            {promo.items.map((it, k) => (
              <li key={k} style={{ '--k': k } as CSSProperties}>
                <h2>{it.name}</h2>
                {it.price && (
                  <p className="pr">
                    {it.price}
                    {it.was && <s>{it.was}</s>}
                  </p>
                )}
                {it.detail && <p className="det">{it.detail}</p>}
                {it.until && <p className="det until">ถึง {it.until}</p>}
              </li>
            ))}
          </ul>
          {promo.note && <p className="pm-fine">{promo.note}</p>}
          <a className="pm-btn" href={lineChatUrl(line.oaId, promo.title === 'โปรโมชั่น' ? 'สนใจโปรโมชั่น' : `สนใจโปร${promo.title}`)}>
            {lineIcon}
            สั่งทาง LINE
          </a>
        </article>
      ) : (
        <section className="pm-none">
          <h1>ตอนนี้ยังไม่มีโปรนะคะ</h1>
          <p>มีโปรเมื่อไหร่ June แจ้งใน LINE ก่อนใคร</p>
          <a className="pm-btn light" href={lineChatUrl(line.oaId)}>
            {lineIcon}
            คุยกับร้านทาง LINE
          </a>
        </section>
      )}
    </main>
  )
}
