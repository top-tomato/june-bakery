import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { menuQueries } from '@/api/menu'
import { GalleryPage } from '@/features/gallery/GalleryPage'

export const Route = createFileRoute('/gallery')({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(menuQueries.all()),
  component: Gallery,
})

function Gallery() {
  const { data } = useSuspenseQuery(menuQueries.all())
  return <GalleryPage data={data} />
}
