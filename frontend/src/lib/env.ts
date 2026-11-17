/** Things decided once per page load. */

declare global {
  interface Window {
    /** frozen viewport height in px, set by the inline script in menu/templates/menu/app.html */
    __VH?: number
  }
}

export const calm = matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Stable viewport height for all scroll maths. Phones change innerHeight while their toolbars slide in and out
 * (and LINE's in-app browser resizes the whole page), so anything computed from innerHeight twitched on scroll.
 * CSS uses var(--vh) from the same number. Only changes on rotation (the shell fires `vhchange`).
 */
export const viewportHeight = () => window.__VH ?? innerHeight

/**
 * Debug switches for finding jank on a real phone (no effect unless asked for):
 *   ?fps  on-screen frame meter      ?no3d  photos instead of the 3D scene   ?lowres  3D at 1x, no antialias
 *   ?nodrips  hide the cream drips   ?nomap hide the map                      ?log  with ?fps, report to the dev server log
 * Opening the dev server over Wi-Fi (port 8765) turns on fps+log automatically.
 */
const params = new URLSearchParams(location.search)
const lanDev = /^(192\.168|10)\./.test(location.hostname) && location.port === '8765'
export const debug = {
  fps: params.has('fps') || lanDev,
  log: params.has('log') || lanDev,
  no3d: params.has('no3d'),
  lowres: params.has('lowres'),
  nodrips: params.has('nodrips'),
  nomap: params.has('nomap'),
}
for (const [k, on] of Object.entries(debug)) if (on) document.documentElement.classList.add(`dbg-${k}`)

export const hasWebGL = (() => {
  try {
    return !!document.createElement('canvas').getContext('webgl')
  } catch {
    return false
  }
})()
