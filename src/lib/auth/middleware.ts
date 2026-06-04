import { createMiddleware } from '@tanstack/react-start'
import { createSupabaseServerClient } from '#/lib/supabase/server'
import type { AppRole, AuthState, Profile } from '#/lib/types'
import { FEATURES } from '#/lib/constants'

export type AuthMiddlewareContext = {
  auth: AuthState
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
}

async function loadAuthState(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<AuthState | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  return {
    userId: user.id,
    email: user.email ?? '',
    profile: (profileRes.data as Profile | null) ?? null,
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
      throw new Error('Unauthorized')
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
      throw new Error('Forbidden')
    }
    return next({ context })
  })
