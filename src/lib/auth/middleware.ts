import { createMiddleware } from '@tanstack/react-start'
import { createSupabaseServerClient } from '#/lib/supabase/server'
import type { AppRole, AuthState, Profile } from '#/lib/types'
import { FEATURES } from '#/lib/constants'
import { AuthError } from '#/lib/auth/errors'

export type AuthMiddlewareContext = {
  auth: AuthState
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
}

function isStaleSessionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as { code?: string; message?: string }
  return (
    err.code === 'refresh_token_not_found' ||
    err.message?.includes('Refresh Token') === true ||
    err.message?.includes('Invalid Refresh Token') === true
  )
}

async function clearStaleSession(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  try {
    await supabase.auth.signOut()
  } catch {
    // Ignore — cookies may already be invalid
  }
}

export async function loadAuthState(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<AuthState | null> {
  let user

  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      if (isStaleSessionError(error)) {
        await clearStaleSession(supabase)
      }
      return null
    }
    user = data.user
  } catch (error) {
    if (isStaleSessionError(error)) {
      await clearStaleSession(supabase)
    }
    return null
  }

  if (!user) return null

  const [profileRes, rolesRes, featuresRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', user.id),
    supabase
      .from('user_feature_access')
      .select('feature, allowed')
      .eq('user_id', user.id),
  ])

  const roles = (rolesRes.data ?? []).map((r) => r.role as AppRole)
  const features: Record<string, boolean> = {}

  for (const f of Object.values(FEATURES)) {
    features[f] = roles.includes('admin')
  }

  for (const row of featuresRes.data ?? []) {
    if (row.allowed) features[row.feature] = true
  }

  const profile = (profileRes.data as Profile | null) ?? null

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? '',
    profile,
    roles,
    features,
  }
}

export const attachSupabaseAuth = createMiddleware({ type: 'function' })
  .server(async ({ next }) => {
    const supabase = await createSupabaseServerClient()
    const auth = await loadAuthState(supabase)
    return next({
      context: {
        supabase,
        auth,
      },
    })
  })

export const requireSupabaseAuth = createMiddleware({ type: 'function' })
  .middleware([attachSupabaseAuth])
  .server(async ({ next, context }) => {
    if (!context.auth) {
      throw new AuthError('UNAUTHORIZED')
    }
    return next({
      context: {
        auth: context.auth as AuthState,
        supabase: context.supabase,
      },
    })
  })

export const requireAdmin = createMiddleware({ type: 'function' })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const auth = context.auth as AuthState
    if (!auth.roles.includes('admin')) {
      throw new AuthError('FORBIDDEN')
    }
    return next({ context })
  })
