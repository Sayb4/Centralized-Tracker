import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { usernameToEmail } from '#/lib/auth/config'
import {
  getLoginErrorMessage,
  mapSupabaseLoginError,
} from '#/lib/auth/errors'
import {
  buildLoginRateLimitKey,
  checkLoginRateLimit,
  clearLoginAttempts,
  getClientIpFromRequest,
  recordLoginFailure,
} from '#/lib/auth/rate-limit'
import { attachSupabaseAuth, loadAuthState, requireSupabaseAuth } from '#/lib/auth/middleware'
import { createSupabaseServerClient } from '#/lib/supabase/server'
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

const signInInputSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export const signIn = createServerFn({ method: 'POST' })
  .inputValidator(signInInputSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const ip = getClientIpFromRequest(request)
    const identifier = usernameToEmail(data.username)
    const rateLimitKey = buildLoginRateLimitKey(ip, identifier)

    const rateLimit = checkLoginRateLimit(rateLimitKey)
    if (!rateLimit.allowed) {
      return {
        ok: false as const,
        code: 'rate_limited' as const,
        message: getLoginErrorMessage('rate_limited'),
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      }
    }

    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: identifier,
      password: data.password,
    })

    if (error) {
      recordLoginFailure(rateLimitKey)
      const mapped = mapSupabaseLoginError(error)
      return {
        ok: false as const,
        code: mapped.code,
        message: mapped.message,
      }
    }

    const auth = await loadAuthState(supabase)
    if (!auth?.roles.includes('admin')) {
      await supabase.auth.signOut()
      recordLoginFailure(rateLimitKey)
      return {
        ok: false as const,
        code: 'admin_only' as const,
        message: getLoginErrorMessage('admin_only'),
      }
    }

    clearLoginAttempts(rateLimitKey)
    return { ok: true as const }
  })

export const signOut = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.auth.signOut()
    return { ok: true }
  })
