import { useMemo } from 'react'
import type { MenuData } from '@/api/menu'
import { BackHome, FlipBook, useBookLayout } from './FlipBook'
import { buildPages } from './pages'

/** The menu book (/book). */
export function BookPage({ data }: { data: MenuData }) {
  const pages = useMemo(() => buildPages(data), [data])
  const { single } = useBookLayout()
  return <FlipBook pages={pages} hint={`ปัดหรือลากมุมเพื่อพลิก${single ? '' : ' · แตะหน้าเพื่อดูใกล้ ๆ'}`} back={<BackHome />} />
}
