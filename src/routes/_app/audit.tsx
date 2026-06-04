import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { listAuditLog } from '#/server/audit'
import { AppHeader } from '#/components/layout/app-header'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import { Input } from '#/components/ui/input'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

export const Route = createFileRoute('/_app/audit')({
  beforeLoad: async () => {
    const { getAuthState } = await import('#/server/auth')
    const auth = await getAuthState()
    if (!auth?.roles.includes('admin')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AuditPage,
})

function actionVariant(action: string) {
  if (action === 'INSERT') return 'default' as const
  if (action === 'UPDATE') return 'secondary' as const
  return 'destructive' as const
}

function summarizeChange(
  action: string,
  entityType: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) {
  if (action === 'INSERT') return `Created ${entityType} record`
  if (action === 'DELETE') return `Deleted ${entityType} record`
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ])
  const changed = [...keys].filter(
    (k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]),
  )
  if (changed.length === 0) return `Updated ${entityType}`
  return `Updated ${entityType}: ${changed.slice(0, 3).join(', ')}${changed.length > 3 ? '…' : ''}`
}

function AuditPage() {
  const [page, setPage] = useState(1)
  const [actorEmail, setActorEmail] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, actorEmail],
    queryFn: () =>
      listAuditLog({
        data: { page, actorEmail: actorEmail || undefined },
      }),
  })

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0

  return (
    <>
      <AppHeader title="Audit Log" />
      <main className="flex-1 space-y-4 p-6">
        <Input
          placeholder="Filter by actor email"
          value={actorEmail}
          onChange={(e) => {
            setActorEmail(e.target.value)
            setPage(1)
          }}
          className="max-w-sm"
        />

        {isLoading || !data ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>When</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.entries.map((entry) => {
                    const isOpen = expanded.has(entry.id)
                    return (
                      <Collapsible
                        key={entry.id}
                        open={isOpen}
                        onOpenChange={() =>
                          setExpanded((prev) => {
                            const next = new Set(prev)
                            if (next.has(entry.id)) next.delete(entry.id)
                            else next.add(entry.id)
                            return next
                          })
                        }
                        asChild
                      >
                        <>
                          <TableRow>
                            <TableCell>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  {isOpen ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {new Date(entry.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell>{entry.actor_email ?? '—'}</TableCell>
                            <TableCell>{entry.entity_type}</TableCell>
                            <TableCell>
                              <Badge variant={actionVariant(entry.action)}>
                                {entry.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-xs truncate text-sm">
                              {summarizeChange(
                                entry.action,
                                entry.entity_type,
                                entry.before,
                                entry.after,
                              )}
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <TableRow>
                              <TableCell colSpan={6} className="bg-muted/30 p-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                  <div>
                                    <p className="mb-1 text-xs font-medium">Before</p>
                                    <pre className="max-h-48 overflow-auto rounded border bg-background p-2 text-xs">
                                      {JSON.stringify(entry.before, null, 2) ??
                                        'null'}
                                    </pre>
                                  </div>
                                  <div>
                                    <p className="mb-1 text-xs font-medium">After</p>
                                    <pre className="max-h-48 overflow-auto rounded border bg-background p-2 text-xs">
                                      {JSON.stringify(entry.after, null, 2) ??
                                        'null'}
                                    </pre>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages || 1} ({data.total} entries)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  )
}
