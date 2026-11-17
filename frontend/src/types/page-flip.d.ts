// page-flip 2.0.7 ships no type declarations; only what the menu book uses.
declare module 'page-flip' {
  export interface FlipSetting {
    width: number
    height: number
    size?: 'fixed' | 'stretch'
    minWidth?: number
    maxWidth?: number
    minHeight?: number
    maxHeight?: number
    usePortrait?: boolean
    showCover?: boolean
    startZIndex?: number
    drawShadow?: boolean
    maxShadowOpacity?: number
    flippingTime?: number
    mobileScrollSupport?: boolean
    swipeDistance?: number
    showPageCorners?: boolean
    disableFlipByClick?: boolean
  }
  export type FlipState = 'user_fold' | 'fold_corner' | 'flipping' | 'read'
  export type Orientation = 'portrait' | 'landscape'
  export class PageFlip {
    constructor(element: HTMLElement, setting: FlipSetting)
    loadFromHTML(items: NodeListOf<HTMLElement> | HTMLElement[]): void
    on(event: 'flip', cb: (e: { data: number }) => void): this
    on(event: 'changeState', cb: (e: { data: FlipState }) => void): this
    on(event: 'changeOrientation', cb: (e: { data: Orientation }) => void): this
    flipNext(corner?: 'top' | 'bottom'): void
    flipPrev(corner?: 'top' | 'bottom'): void
    flip(page: number, corner?: 'top' | 'bottom'): void
    getCurrentPageIndex(): number
    getOrientation(): Orientation
    destroy(): void
  }
}
