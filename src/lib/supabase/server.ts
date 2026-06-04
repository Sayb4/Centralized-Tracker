import { createServerClient } from '@supabase/ssr'
import { getRequest } from '@tanstack/react-start/server'

export async function createSupabaseServerClient() {
  const url = process.env.VITE_SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL
  const key =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY',
    )
  }

  const request = getRequest()
  const cookieHeader = request.headers.get('cookie') ?? ''

  const cookies = cookieHeader.split(';').reduce<Record<string, string>>(
    (acc, part) => {
      const [name, ...rest] = part.trim().split('=')
      if (name) acc[name] = rest.join('=')
      return acc
    },
    {},
  )

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return Object.entries(cookies).map(([name, value]) => ({
          name,
          value: decodeURIComponent(value),
        }))
      },
      setAll() {
        // Response cookies set via Set-Cookie in auth flows on client
      },
    },
  })
}
