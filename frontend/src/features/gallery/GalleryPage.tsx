import { useMemo, useState } from 'react'
import type { MenuData } from '@/api/menu'
import { BackHome, FlipBook, useBookLayout } from '@/features/book/FlipBook'
import { ALBUM, takeArriving } from './handoff'
import { Notepad } from './Notepad'
import { buildSheets, FILLER, toFlipPages } from './pages'

/** The photo book (/gallery): a side-bound book on wide screens, a top-bound notepad on phones. */
export function GalleryPage({ data }: { data: MenuData }) {
  const { single } = useBookLayout()
  const [arriving] = useState(takeArriving)
  const hint = single ? 'ปัดขึ้นหรือปัดซ้ายเพื่อเปิด' : 'ลากมุมขวาล่างเพื่อเปิด →'
  const sheets = useMemo(() => buildSheets(data, hint), [data, hint])
  const flipPages = useMemo(() => toFlipPages(sheets), [sheets])
  const back = <BackHome hash="gallery" />

  if (!data.gallery.length) {
    return (
      <div className="book-page">
        {back}
        <p className="book-hint">ร้านกำลังเตรียมรูป แวะมาดูใหม่นะ</p>
      </div>
    )
  }
  return single ? (
    <Notepad sheets={sheets} hint="สมุดรูปจากครัว June · ปัดขึ้นหรือปัดซ้ายเพื่อพลิก" back={back} autoOpen={arriving} vtName={ALBUM} />
  ) : (
    <FlipBook pages={flipPages} filler={FILLER} insideCovers hint="สมุดรูปจากครัว June · ปัดหรือลากมุมเพื่อพลิก · แตะหน้าเพื่อดูใกล้ ๆ" back={back} autoOpen={arriving} vtName={ALBUM} />
  )
}
