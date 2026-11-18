import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { menuQueries } from '@/api/menu'
import { PromoPage } from '@/features/promo/PromoPage'

/** this month's promotion flyer, opened from the "โปรโมชั่น" button in the LINE rich menu */
export const Route = createFileRoute('/promo')({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(menuQueries.all()),
  component: Promo,
})

function Promo() {
  const { data } = useSuspenseQuery(menuQueries.all())
  return <PromoPage data={data} />
}
