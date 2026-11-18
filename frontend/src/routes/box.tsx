import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { menuQueries } from '@/api/menu'
import { BoxThanks } from '@/features/box/BoxThanks'

/** the page the QR sticker on the box opens (through /q/box, which counts the scan) */
export const Route = createFileRoute('/box')({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(menuQueries.all()),
  component: Box,
})

function Box() {
  const { data } = useSuspenseQuery(menuQueries.all())
  return <BoxThanks data={data} />
}
