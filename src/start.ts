import { createStart } from '@tanstack/react-start'
import { attachSupabaseAuth } from '#/lib/auth/middleware'

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
}))
