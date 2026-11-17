import type { CSSProperties } from 'react'
import type { MenuData } from '@/api/menu'
import mapImage from '@/assets/where-map.webp'
import { ChatIcon, MapPinIcon } from '@/components/icons'
import { Drips } from './Drips'

/** Where the pin sits on the baked map picture (from mock/where-map-3d.html when the picture was rendered). */
const PIN = { x: '51.14%', y: '39.05%' }

interface Props {
  shop: MenuData['shop']
  line: MenuData['line']
  /** colour of the story section above (the drips hang from it) */
  above: string
}

export function Where({ shop, line, above }: Props) {
  return (
    <section className="where" id="where" data-nav="light">
      <Drips count={24} color={above} />
      <div>
        <h2>
          แวะหยิบได้
          <br />
          ที่หน้าร้าน
        </h2>
        <div className="shop">
          <b>{shop.name}</b>
          <span>{shop.address}</span>
          <span>เวลาเปิด: {shop.hours}</span>
        </div>
        <a className="btn go" href={shop.mapsUrl} target="_blank" rel="noopener">
          <MapPinIcon />
          นำทางด้วย Google Maps
        </a>
        <div className="contact">
          <h3>ติดต่อร้าน</h3>
          <div className="social">
            <a href={line.addUrl} target="_blank" rel="noopener">
              <ChatIcon />
              LINE {line.oaId}
            </a>
            {/* Instagram / Facebook: add once the shop sends its links */}
          </div>
        </div>
      </div>
      <div>
        {/* 3D street map of the real spot baked to one picture; a live tilted 3D layer stalled phones on fast scroll */}
        <a className="map" href={shop.mapsUrl} target="_blank" rel="noopener" aria-label={`แผนที่${shop.name} เปิดใน Google Maps`}>
          <img src={mapImage} alt="" width={1750} height={1313} decoding="async" fetchPriority="low" />
          <span className="pin" style={{ '--px': PIN.x, '--py': PIN.y } as CSSProperties}>
            <b>June อยู่ตรงนี้</b>
            <i />
            <s />
          </span>
        </a>
        <p className="approx">แผนที่โดยประมาณ · แตะเพื่อเปิด Google Maps</p>
      </div>
    </section>
  )
}
