import type { CSSProperties } from 'react'
import { Link } from '@tanstack/react-router'
import type { MenuData } from '@/api/menu'
import { Snapshots } from '@/features/gallery/Snapshots'
import { Drips } from './Drips'

/** Optional sections: each one only renders once the shop has filled it in (Django admin).
 * `flush`: the section above has the same background, so no drips (they would be invisible) and no room kept for them. */

export function Reviews({ reviews, above, flush }: { reviews: MenuData['reviews']; above: string; flush?: boolean }) {
  return (
    <section className={flush ? 'reviews flush' : 'reviews'} id="reviews" data-nav="light">
      {!flush && <Drips count={22} color={above} />}
      <div className="wrap">
        <p className="kicker reveal">คนที่ลองแล้ว</p>
        <h2 className="sec-title reveal" style={{ '--i': 1 } as CSSProperties}>
          เสียงจากลูกค้า
        </h2>
        <div className="quotes">
          {reviews.map((r, k) => (
            <figure key={r.id} className="quote reveal" style={{ '--i': 2 + Math.min(k, 3) } as CSSProperties}>
              <blockquote>“{r.text}”</blockquote>
              <figcaption>— {r.author}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

export function About({ about, above, flush }: { about: NonNullable<MenuData['about']>; above: string; flush?: boolean }) {
  return (
    <section className={flush ? 'about flush' : 'about'} id="about" data-nav="dark">
      {!flush && <Drips count={22} color={above} />}
      <div className={about.photo ? 'wrap about-grid' : 'wrap'}>
        {about.photo && <img className="about-photo" src={about.photo} alt="" loading="lazy" decoding="async" />}
        <div>
          <p className="kicker reveal">เรื่องของ June</p>
          {about.title && (
            <h2 className="sec-title reveal" style={{ '--i': 1 } as CSSProperties}>
              {about.title}
            </h2>
          )}
          <p className="about-text reveal" style={{ '--i': 2 } as CSSProperties}>
            {about.text}
          </p>
        </div>
      </div>
    </section>
  )
}

const SHOWN = 6

/** The homepage's photo section (mock/gallery-scrapbook.html): the first few snapshots, then "ดูทั้งหมด" -> /gallery.
 * id="gallery": linkable as /#gallery. */
export function Gallery({ photos, above, flush }: { photos: MenuData['gallery']; above: string; flush?: boolean }) {
  return (
    <section className={flush ? 'gallery flush' : 'gallery'} id="gallery" data-nav="dark">
      {!flush && <Drips count={22} color={above} />}
      <div className="wrap">
        <p className="kicker reveal">Gallery</p>
        <h2 className="sec-title reveal" style={{ '--i': 1 } as CSSProperties}>
          จากครัว June
        </h2>
        <p className="gal-sub reveal" style={{ '--i': 2 } as CSSProperties}>
          อบเสร็จ ถ่ายเก็บไว้ทุกวัน
        </p>
        <Snapshots items={photos.slice(0, SHOWN)} />
        <div className="more reveal">
          <Link to="/gallery" className="btn">
            ดูทั้งหมด{photos.length > SHOWN ? ` (${photos.length})` : ''}
          </Link>
        </div>
      </div>
    </section>
  )
}
