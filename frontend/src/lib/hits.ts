/**
 * Visit / "order on LINE" counters for the shop summary (menu/stats.py). One visit per browser tab session, one tap per
 * click on any link to LINE. Sends only the kind and where the visitor came from: no cookies, no IDs.
 */
type Source = 'line' | 'instagram' | 'facebook' | 'tiktok' | 'google' | 'direct' | 'other'

function source(): Source {
  if (/ Line\//i.test(navigator.userAgent)) return 'line' // LINE's in-app browser (rich menu, chats)
  const ref = document.referrer
  try {
    if (!ref || new URL(ref).host === location.host) return 'direct'
  } catch {
    return 'other'
  }
  if (/instagram/i.test(ref)) return 'instagram'
  if (/facebook|fb\.|messenger/i.test(ref)) return 'facebook'
  if (/tiktok/i.test(ref)) return 'tiktok'
  if (/google\./i.test(ref)) return 'google'
  return 'other'
}

function send(k: 'visit' | 'tap', src: string) {
  try {
    navigator.sendBeacon('/api/hit/', JSON.stringify({ k, src }))
  } catch {
    /* counting must never break the page */
  }
}

const KEY = 'june-src'
export function startHits() {
  let src: string
  try {
    src = sessionStorage.getItem(KEY) ?? ''
    if (!src) {
      src = source()
      sessionStorage.setItem(KEY, src)
      send('visit', src)
    }
  } catch {
    src = source() // storage blocked (private mode): count anyway
    send('visit', src)
  }
  document.addEventListener(
    'click',
    (e) => {
      if ((e.target as Element | null)?.closest?.('a[href*="line.me"]')) send('tap', src)
    },
    { capture: true },
  )
}
