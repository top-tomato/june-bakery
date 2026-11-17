import type { MenuData } from '@/api/menu'
import { Drips } from './Drips'

/** Three steps, then the two facts customers need before ordering (shown only once the shop fills them in). */
export function HowToOrder({ order, shopName, above }: { order: MenuData['order']; shopName: string; above: string }) {
  const facts = [
    order.preorderDays != null && { label: 'สั่งล่วงหน้า', value: order.preorderDays === 0 ? 'สั่งวันนี้ รับวันนี้ได้' : `อย่างน้อย ${order.preorderDays} วัน` },
    order.shelfLife && { label: 'เก็บได้', value: order.shelfLife },
    order.payment && { label: 'จ่ายเงิน', value: order.payment },
  ].filter((f): f is { label: string; value: string } => !!f)

  return (
    <section className="how" id="how" data-nav="dark">
      <Drips count={22} color={above} />
      <div className="wrap">
        <p className="kicker">วิธีสั่ง</p>
        <h2 className="sec-title">ง่าย ๆ 3 ขั้น</h2>
        <ol className="steps">
          <li>
            <b>ทัก LINE</b>บอกจำนวน และวันที่อยากรับ
          </li>
          <li>
            <b>ร้านตอบกลับ</b>ยืนยันออเดอร์ให้ในแชต
          </li>
          <li>
            <b>รับที่หน้าร้าน</b>
            {shopName}
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
