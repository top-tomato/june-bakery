import { calm } from '@/lib/env'

/**
 * The logo curtain plays once per page load. Coming back to the homepage (or opening /gallery) after it has played
 * skips it, and whatever was timed to it — the cake dropping in, the snapshots landing — must not wait for it either.
 */
let played = false
export const curtainWillPlay = () => !calm && !played
export const markCurtainPlayed = () => {
  played = true
}
/** ms until the curtain uncovers the page, for things that should appear as it lifts (0 if it won't play) */
export const introDelayMs = () => (curtainWillPlay() ? 1600 : 0)
/** the cake starts dropping in this long after the homepage mounts (timed to the curtain on first load) */
export const cakeIntroDelayMs = () => (curtainWillPlay() ? 2500 : 0)
