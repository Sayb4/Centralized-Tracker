import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireAdmin } from '#/lib/auth/middleware'
import { createSupabaseAdminClient } from '#/lib/supabase/admin'
import type { AuditLogEntry } from '#/lib/types'

const PAGE_SIZE = 50

export const listAuditLog = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .inputValidator(
    z.object({
      page: z.number().int().min(1).default(1),
      actorEmail: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const admin = createSupabaseAdminClient()
    const from = (data.page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = admin
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (data.actorEmail?.trim()) {
      query = query.ilike('actor_email', `%${data.actorEmail.trim()}%`)
    }

    const { data: rows, error, count } = await query

    if (error) throw new Error(error.message)

    return {
      entries: (rows ?? []) as AuditLogEntry[],
      total: count ?? 0,
      page: data.page,
      pageSize: PAGE_SIZE,
    }
  })
