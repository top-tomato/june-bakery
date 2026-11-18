import type { CSSProperties } from 'react'
import type { MenuData } from '@/api/menu'
import mapImage from '@/assets/where-map.webp'
import { MapPinIcon } from '@/components/icons'
import { Drips } from './Drips'

/** Where the pin sits on the baked map picture (from mock/where-map-3d.html when the picture was rendered). */
const PIN = { x: '51.14%', y: '39.05%' }

interface Props {
  shop: MenuData['shop']
  /** closed days (back office calendar); not shown in preview/jemmy-order, kept so the page wiring stays the same */
  closedDays?: string[]
  /** colour of the story section above (the drips hang from it) */
  above: string
}

export function Where({ shop, above }: Props) {
  return (
    <section className="where" id="where" data-nav="light">
      <Drips count={24} color={above} />
      <div>
        <h2 className="reveal">
          แวะหยิบได้
          <br />
          ที่หน้าร้าน
        </h2>
        {/* preview/jemmy-order: only the opening hours stay from the shop box (no name, address, closed days) */}
        {shop.hours && <p className="hours reveal" style={{ '--i': 1 } as CSSProperties}>เวลาเปิด {shop.hours}</p>}
        <a className="btn go reveal" style={{ '--i': 2 } as CSSProperties} href={shop.mapsUrl} target="_blank" rel="noopener">
          <MapPinIcon />
          นำทางด้วย Google Maps
        </a>
      </div>
      <div>
        {/* 3D street map of the real spot baked to one picture; a live tilted 3D layer stalled phones on fast scroll */}
        <a className="map reveal" href={shop.mapsUrl} target="_blank" rel="noopener" aria-label={`แผนที่${shop.name} เปิดใน Google Maps`}>
          <img src={mapImage} alt="" width={1750} height={1313} decoding="async" fetchPriority="low" />
          <span className="pin" style={{ '--px': PIN.x, '--py': PIN.y } as CSSProperties}>
            <b>June อยู่ตรงนี้</b>
            <i />
            <s />
          </span>
        </a>
        <p className="approx reveal" style={{ '--i': 1 } as CSSProperties}>แผนที่โดยประมาณ · แตะเพื่อเปิด Google Maps</p>
      </div>
    </section>
  )
}
