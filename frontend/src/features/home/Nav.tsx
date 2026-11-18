import { useEffect, useRef } from 'react'
import { onFrame } from '@/lib/frame'

/** Top bar. Its colour follows the section under it (data-nav="dark" | "light"); the logo hides on the opening screen,
 * which has the big one. */
export function Nav() {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const nav = ref.current
    if (!nav) return
    let hit: HTMLElement | null = null
    const off = onFrame({
      read: ({ scrolled }) => {
        if (!scrolled) return
        hit = null
        for (const s of document.querySelectorAll<HTMLElement>('[data-nav]')) {
          const r = s.getBoundingClientRect()
          if (r.top <= 40 && r.bottom > 40) {
            hit = s
            break
          }
        }
      },
      write: ({ scrolled }) => {
        if (!scrolled || !hit) return
        nav.classList.toggle('dark', hit.dataset.nav === 'dark')
        nav.classList.toggle('top', hit.id === 'opening')
      },
    })
    return off
  }, [])

  return (
    <header ref={ref} className="nav top">
      <a href="#flavors">เมนู</a>
      <span className="brand logo-mask" role="img" aria-label="June" />
    </header>
  )
}
