import { Link } from '@tanstack/react-router'
import type { MenuData } from '@/api/menu'
import { Snapshots } from '@/features/gallery/Snapshots'
import { Drips } from './Drips'

/** Optional sections: each one only renders once the shop has filled it in (Django admin). */

export function Reviews({ reviews, above }: { reviews: MenuData['reviews']; above: string }) {
  return (
    <section className="reviews" id="reviews" data-nav="light">
      <Drips count={22} color={above} />
      <div className="wrap">
        <p className="kicker">คนที่ลองแล้ว</p>
        <h2 className="sec-title">เสียงจากลูกค้า</h2>
        <div className="quotes">
          {reviews.map((r) => (
            <figure key={r.id} className="quote">
              <blockquote>“{r.text}”</blockquote>
              <figcaption>— {r.author}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

export function About({ about, above }: { about: NonNullable<MenuData['about']>; above: string }) {
  return (
    <section className="about" id="about" data-nav="dark">
      <Drips count={22} color={above} />
      <div className={about.photo ? 'wrap about-grid' : 'wrap'}>
        {about.photo && <img className="about-photo" src={about.photo} alt="" loading="lazy" decoding="async" />}
        <div>
          <p className="kicker">เรื่องของ June</p>
          {about.title && <h2 className="sec-title">{about.title}</h2>}
          <p className="about-text">{about.text}</p>
        </div>
      </div>
    </section>
  )
}

const SHOWN = 6

/** The homepage's photo section (mock/gallery-scrapbook.html): the first few snapshots, then "ดูทั้งหมด" -> /gallery.
 * id="gallery": linkable as /#gallery. */
export function Gallery({ photos, above }: { photos: MenuData['gallery']; above: string }) {
  return (
    <section className="gallery" id="gallery" data-nav="dark">
      <Drips count={22} color={above} />
      <div className="wrap">
        <p className="kicker">Gallery</p>
        <h2 className="sec-title">จากครัว June</h2>
        <p className="gal-sub">อบเสร็จ ถ่ายเก็บไว้ทุกวัน</p>
        <Snapshots items={photos.slice(0, SHOWN)} />
        <div className="more">
          <Link to="/gallery" className="btn">
            ดูทั้งหมด{photos.length > SHOWN ? ` (${photos.length})` : ''}
          </Link>
        </div>
      </div>
    </section>
  )
}
