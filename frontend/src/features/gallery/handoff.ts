/**
 * Homepage -> photo book hand-off. The homepage's "เปิดสมุดรูปทั้งเล่ม" gathers the photos into a pile, then a view
 * transition morphs the top card (view-transition-name ALBUM) into the closed book on /gallery, which has the same name;
 * the book then opens its cover by itself. Opening /gallery directly (rich menu link) skips all of that.
 */
export const ALBUM = 'album'

let arriving = false
export const markArriving = () => {
  arriving = true
}
/** read once by the photo book: did we just morph in from the homepage? */
export const takeArriving = () => {
  const a = arriving
  arriving = false
  return a
}
