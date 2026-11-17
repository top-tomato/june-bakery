import './styles/base.css'
import './styles/rings.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { menuQueries, readBootstrap } from './api/menu'
import { startHits } from './lib/hits'
import { routeTree } from './routeTree.gen'

// count visits for the shop summary (not while developing locally, unless ?hits)
if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.search.includes('hits')) startHits()

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 60 * 1000 } },
})

// Django already put the menu in the page: seed the cache so the first route renders without a request
const bootstrap = readBootstrap()
if (bootstrap) queryClient.setQueryData(menuQueries.all().queryKey, bootstrap)

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  // the router's own preload cache stays off; TanStack Query is the single cache (tanstack-integration: cache-single-source)
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const root = document.getElementById('root')
if (!root) throw new Error('#root missing in menu/templates/menu/app.html')
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
// the app has drawn its first frame (the curtain is up on / and /gallery): drop the cream start-up background
requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove('booting')))
