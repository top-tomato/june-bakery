import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet, type ErrorComponentProps } from '@tanstack/react-router'
import { DebugMeter } from '@/components/DebugMeter'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
  errorComponent: RootError,
})

function RootLayout() {
  return (
    <>
      <Outlet />
      <DebugMeter />
    </>
  )
}

function NotFound() {
  return (
    <main className="plain-page">
      <h1>ไม่เจอหน้านี้</h1>
      <Link to="/" className="btn">
        กลับหน้าแรก
      </Link>
    </main>
  )
}

function RootError({ error, reset }: ErrorComponentProps) {
  return (
    <main className="plain-page">
      <h1>ขอโทษนะ หน้านี้มีปัญหา</h1>
      <p>{error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'}</p>
      <button type="button" className="btn" onClick={reset}>
        ลองใหม่
      </button>
    </main>
  )
}
