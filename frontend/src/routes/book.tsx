import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { menuQueries } from '@/api/menu'
import { BookPage } from '@/features/book/BookPage'

export const Route = createFileRoute('/book')({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(menuQueries.all()),
  component: Book,
})

function Book() {
  const { data } = useSuspenseQuery(menuQueries.all())
  return <BookPage data={data} />
}
