import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { menuQueries } from '@/api/menu'
import { HomePage } from '@/features/home/HomePage'

export const Route = createFileRoute('/')({
  // usually already in the cache from the data Django embedded in the page
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(menuQueries.all()),
  component: Home,
})

function Home() {
  const { data } = useSuspenseQuery(menuQueries.all())
  return <HomePage data={data} />
}
