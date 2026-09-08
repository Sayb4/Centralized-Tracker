import type { SupabaseClient } from '@supabase/supabase-js'

export async function fetchActiveDivisionNames(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('divisions')
    .select('name')
    .eq('active', true)

  if (error) throw new Error(error.message)
  return new Set((data ?? []).map((row) => row.name as string))
}

export function assertDivisionAllowed(
  division: string,
  allowed: Set<string>,
): void {
  if (!allowed.has(division)) {
    throw new Error('Invalid division')
  }
}
