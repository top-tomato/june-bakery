import { useEffect, type CSSProperties } from 'react'
import { lineChatUrl, type MenuData } from '@/api/menu'
import { JuneLogo } from '@/components/JuneLogo'
import '../home/home.css'
import './promo.css'

const lineIcon = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.5s5.9-3.5 8-6C21.4 14.2 22 12.7 22 11c0-4.4-4.5-8-10-8Z" />
  </svg>
)

/**
 * This month's promotions as a simple flyer to read (mock/promo.html A): the month, one line per promo with its price,
 * the end date, and a single "order on LINE" button. No promo (none written, or past its end date) = a short note and
 * a chat button. Opening: the logo's palm sways, the sheet drops in like it's pinned to a board, the lines float up.
 */
export function PromoPage({ data }: { data: MenuData }) {
  const { promo, line } = data

  useEffect(() => {
    document.title = 'โปรเดือนนี้ · June'
  }, [])

  return (
    <main className="pm">
      <JuneLogo className="logo go" role="img" aria-label="June" aria-hidden={false} />
      {promo ? (
        <article className="pm-sheet">
          <p className="pm-month">{promo.month}</p>
          <h1>โปรเดือนนี้</h1>
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
              </li>
            ))}
          </ul>
          {(promo.until || promo.note) && (
            <p className="pm-fine">{[promo.until && `ถึง ${promo.until}`, promo.note].filter(Boolean).join(' · ')}</p>
          )}
          <a className="pm-btn" href={lineChatUrl(line.oaId, `สนใจโปรเดือน${promo.month.split(' ')[0]}`)}>
            {lineIcon}
            สั่งทาง LINE
          </a>
        </article>
      ) : (
        <section className="pm-none">
          <h1>เดือนนี้ยังไม่มีโปรนะคะ</h1>
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
