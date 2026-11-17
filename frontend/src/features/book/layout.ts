/**
 * How big the book can be on this screen, and whether it shows one page or a two-page spread.
 *
 * The first version decided by width alone and let page-flip "stretch". On a 1280x720 laptop at 100% zoom the spread
 * didn't fit the height, page-flip fell back to one page but kept the spread's width, and the page came out ~1200px
 * tall — off the top and bottom of the screen (it only looked right at 80% zoom). Now both sizes are worked out here
 * from the space we really have, and page-flip gets a fixed page size.
 */
export const PAGE_RATIO = 360 / 680 // width / height of one page

export interface BookLayout {
  single: boolean
  pageW: number
  pageH: number
}

export function bookLayout(width: number, height: number): BookLayout {
  const availW = width - 24
  const availH = height - (height < 560 ? 70 : 130) // hint line + page buttons
  const spreadW = Math.floor(Math.min(availW / 2, availH * PAGE_RATIO))
  const singleW = Math.floor(Math.min(availW, availH * PAGE_RATIO))
  // Spread when its pages are still readable (>= 300px), or when height is the limit anyway (same page size either way).
  const single = spreadW < Math.min(300, singleW)
  const pageW = single ? singleW : spreadW
  return { single, pageW, pageH: Math.round(pageW / PAGE_RATIO) }
}
