import { queryOptions } from '@tanstack/react-query'

/** One cake, as returned by Django `Product.as_payload()` (menu/models.py). */
export interface Product {
  id: number
  name: [string, string]
  description: string
  price: number
  image: string
  /** URL of a .glb model, or "" when the cake has only a photo */
  model: string
  /** background colour of this cake's story section (#RRGGBB) */
  accent: string
  highlights: string[]
}

export interface GalleryItem {
  id: number
  /** photo URL; for a video, its poster ("" when the shop uploaded only the video) */
  image: string
  caption: string
  /** URL of a short .mp4, or "" for a plain photo */
  video: string
  /** tiny blurred JPEG (data: URI) to show while `image` loads; "" if none */
  preview: string
}

export interface MenuData {
  products: Product[]
  line: { oaId: string; addUrl: string; qrSvg: string }
  /** links the shop has set (missing = no button) */
  social: { instagram?: string; facebook?: string }
  shop: { name: string; address: string; hours: string; lat: number; lng: number; mapsUrl: string }
  /** facts shown under "how to order" — null/"" = not filled in yet (hidden) */
  order: { preorderDays: number | null; shelfLife: string; payment: string }
  /** the shop's story; null until the shop writes it (section hidden) */
  about: { title: string; text: string; photo: string } | null
  reviews: { id: number; text: string; author: string }[]
  /** photos (and short silent videos, image = poster) for the gallery section (#gallery) and the photo book (/gallery) */
  gallery: GalleryItem[]
  /** days the shop is closed in the next 30 days (ISO yyyy-mm-dd), set in the back office calendar */
  closedDays: string[]
}

export const menuKeys = {
  all: ['menu'] as const,
}

async function fetchMenu(signal?: AbortSignal): Promise<MenuData> {
  const res = await fetch('/api/menu/', { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`โหลดเมนูไม่สำเร็จ (${res.status})`)
  return (await res.json()) as MenuData
}

export const menuQueries = {
  all: () =>
    queryOptions({
      queryKey: menuKeys.all,
      queryFn: ({ signal }) => fetchMenu(signal),
      // the menu changes when the shop edits it in Django admin, not while someone is browsing
      staleTime: 5 * 60 * 1000,
    }),
}

/** Menu embedded by Django in the page (json_script#bootstrap), so the first screen needs no extra request. */
export function readBootstrap(): MenuData | undefined {
  const el = document.getElementById('bootstrap')
  if (!el?.textContent) return undefined
  try {
    return JSON.parse(el.textContent) as MenuData
  } catch {
    return undefined
  }
}

export const lineChatUrl = (oaId: string, text?: string) =>
  `https://line.me/R/oaMessage/${encodeURIComponent(oaId)}/${text ? `?${encodeURIComponent(text)}` : ''}`

export const fullName = (p: Product) => p.name.join('')
