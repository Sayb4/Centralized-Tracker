import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '#/lib/auth/middleware'

export const listDivisions = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { data, error } = await context.supabase
      .from('divisions')
      .select('name, sort_order')
      .eq('active', true)
      .order('sort_order')
      .order('name')

    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => row.name as string)
  })
