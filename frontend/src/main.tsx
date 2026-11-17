import './styles/base.css'
import './styles/rings.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { menuQueries, readBootstrap } from './api/menu'
import { routeTree } from './routeTree.gen'

// Opened straight onto an inner page (the rich menu's Gallery button opens /gallery/ in LINE's browser): there is no
// page behind it, so "back" closed the browser. Put the homepage underneath, so back goes home instead.
if (/^\/(gallery|book)\/?$/.test(location.pathname) && history.length <= 2 && !document.referrer) {
  const here = location.pathname + location.search + location.hash
  history.replaceState(null, '', '/')
  history.pushState(null, '', here)
}

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
