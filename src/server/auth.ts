import { createServerFn } from '@tanstack/react-start'
import { attachSupabaseAuth, requireSupabaseAuth } from '#/lib/auth/middleware'
import type { AuthState } from '#/lib/types'

export const getAuthState = createServerFn({ method: 'GET' })
  .middleware([attachSupabaseAuth])
  .handler(async ({ context }): Promise<AuthState | null> => {
    return context.auth ?? null
  })

export const ensureAdminAccess = createServerFn({ method: 'GET' })
  .middleware([attachSupabaseAuth])
  .handler(async ({ context }) => {
    if (!context.auth) {
      return { allowed: false as const, reason: 'unauthenticated' as const }
    }
    if (!context.auth.roles.includes('admin')) {
      await context.supabase.auth.signOut()
      return { allowed: false as const, reason: 'admin_only' as const }
    }
    return { allowed: true as const, auth: context.auth }
  })

export const signOut = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.auth.signOut()
    return { ok: true }
  })
