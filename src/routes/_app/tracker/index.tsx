import { createFileRoute, redirect } from '@tanstack/react-router'
import { TRACKER_DEFAULT_WINDOW } from '#/lib/constants'

export const Route = createFileRoute('/_app/tracker/')({
  beforeLoad: () => {
    throw redirect({
      to: '/tracker/$windowId',
      params: { windowId: TRACKER_DEFAULT_WINDOW },
      search: { tab: 'all' },
    })
  },
})
