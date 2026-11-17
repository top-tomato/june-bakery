import type { CSSProperties } from 'react'
import type { MenuData } from '@/api/menu'
import mapImage from '@/assets/where-map.webp'
import { MapPinIcon } from '@/components/icons'
import { Drips } from './Drips'

/** Where the pin sits on the baked map picture (from mock/where-map-3d.html when the picture was rendered). */
const PIN = { x: '51.14%', y: '39.05%' }

const TH_DAY = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
const TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const thDay = (iso: string) => {
  const d = new Date(`${iso}T00:00`)
  return `${TH_DAY[d.getDay()]} ${d.getDate()} ${TH_MON[d.getMonth()]}`
}

interface Props {
  shop: MenuData['shop']
  /** closed days in the next 30 days (back office calendar), ISO dates */
  closedDays: string[]
  /** colour of the story section above (the drips hang from it) */
  above: string
}

export function Where({ shop, closedDays, above }: Props) {
  const today = new Date().toLocaleDateString('sv')
  const closedToday = closedDays.includes(today)
  const next = closedDays.filter((d) => d > today).slice(0, 3)
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
          {closedToday && <span className="closed">วันนี้ร้านหยุด</span>}
          {next.length > 0 && <span className="closed-next">ร้านหยุด: {next.map(thDay).join(' · ')}</span>}
        </div>
        <a className="btn go" href={shop.mapsUrl} target="_blank" rel="noopener">
          <MapPinIcon />
          นำทางด้วย Google Maps
        </a>
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
