import { createFileRoute, redirect } from '@tanstack/react-router'
import { getAuthState } from '#/server/auth'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const auth = await getAuthState()
    if (auth?.roles.includes('admin')) {
      throw redirect({ to: '/dashboard' })
    }
    throw redirect({ to: '/login' })
  },
})
