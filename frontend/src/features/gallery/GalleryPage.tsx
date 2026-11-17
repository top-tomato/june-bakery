import '@/features/home/home.css'
import './gallery.css'
import { Link } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { lineChatUrl, type MenuData } from '@/api/menu'
import { ChatIcon } from '@/components/icons'
import { Curtain, introDelayMs } from '@/features/home/Curtain'
import { Lightbox } from './Lightbox'
import { Snapshots } from './Snapshots'

/**
 * /gallery: every photo and video as one long scrapbook page (mock/gallery-all.html). Opens like the homepage (the
 * same logo curtain, once per visit) and the snapshots drop in as the curtain lifts. Tap one to see it full screen.
 */
export function GalleryPage({ data }: { data: MenuData }) {
  const [open, setOpen] = useState<number | null>(null)
  const [dropAfter] = useState(introDelayMs) // decided once, before the curtain marks itself played
  const close = useCallback(() => setOpen(null), [])
  const chat = lineChatUrl(data.line.oaId, 'สนใจสั่งชิฟฟ่อนมะพร้าวใบเตย')

  return (
    <>
      <Curtain />
      <header className="gal-top">
        <Link to="/" className="gal-back">
          ← หน้าแรก
        </Link>
        <span className="gal-logo logo-mask" role="img" aria-label="June" />
        <a className="gal-line" href={chat} target="_blank" rel="noopener">
          <ChatIcon />
          สั่งทาง LINE
        </a>
      </header>
      <main className="gal-page">
        <p className="kicker">Gallery</p>
        <h1 className="sec-title">จากครัว June</h1>
        <p className="gal-sub">อบเสร็จ ถ่ายเก็บไว้ทุกวัน</p>
        {data.gallery.length ? (
          <Snapshots items={data.gallery} dropAfter={dropAfter} onOpen={setOpen} />
        ) : (
          <p className="gal-empty">ร้านกำลังเตรียมรูป แวะมาดูใหม่นะ</p>
        )}
        <div className="gal-end">
          <p>อยากชิมแล้ว? ทักมาสั่งได้เลย</p>
          <a className="btn" href={chat} target="_blank" rel="noopener">
            <ChatIcon />
            สั่งทาง LINE
          </a>
        </div>
      </main>
      {open !== null && <Lightbox items={data.gallery} index={open} onIndex={setOpen} onClose={close} />}
    </>
  )
}
