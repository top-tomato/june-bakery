import type { CSSProperties } from 'react'
import type { MenuData } from '@/api/menu'
import { Drips } from './Drips'

/** Three steps (pick up at the shop or have it delivered), then the facts customers need before ordering (shown only once the shop fills them in). */
export function HowToOrder({ order, shopName, above }: { order: MenuData['order']; shopName: string; above: string }) {
  const facts = [
    order.preorderDays != null && { label: 'สั่งล่วงหน้า', value: order.preorderDays === 0 ? 'สั่งวันนี้ รับวันนี้ได้' : `อย่างน้อย ${order.preorderDays} วัน` },
    order.shelfLife && { label: 'เก็บได้', value: order.shelfLife },
    order.payment && { label: 'จ่ายเงิน', value: order.payment },
    order.delivery && { label: 'ส่ง', value: order.delivery },
  ].filter((f): f is { label: string; value: string } => !!f)

  return (
    <section className="how" id="how" data-nav="dark">
      <Drips count={22} color={above} />
      <div className="wrap">
        <p className="kicker reveal">วิธีสั่ง</p>
        <h2 className="sec-title reveal" style={{ '--i': 1 } as CSSProperties}>
          ง่าย ๆ 3 ขั้น
        </h2>
        <ol className="steps">
          <li className="reveal" style={{ '--i': 2 } as CSSProperties}>
            <b>ทัก LINE</b>บอกจำนวน วันที่ และ<em>รับเองหรือให้ส่ง</em>
          </li>
          <li className="reveal" style={{ '--i': 3 } as CSSProperties}>
            <b>ร้านตอบกลับ</b>ยืนยันออเดอร์ และ<em>แจ้งค่าส่ง</em>ในแชต
          </li>
          <li className="reveal" style={{ '--i': 4 } as CSSProperties}>
            <b>รับที่ร้าน หรือส่งถึงที่</b>
            <span className="ways">
              <span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 10 6 4h12l2 6M4 10h16v10H4ZM9 20v-5h6v5" />
                </svg>
                แวะหยิบที่{shopName}
              </span>
              <span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="6" cy="17" r="2.6" />
                  <circle cx="18" cy="17" r="2.6" />
                  <path d="M8.6 17h6.8M15 17l-2.5-7H9M12.5 10h3.5l2 7M3 11h5" />
                  <rect x="2.5" y="6" width="5" height="4" rx="1" />
                </svg>
                ไรเดอร์ส่งถึงมือ
              </span>
            </span>
          </li>
        </ol>
        {facts.length > 0 && (
          <dl className="facts">
            {facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  )
}
