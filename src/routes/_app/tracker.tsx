import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  BUILT_IN_FIELDS,
  DIVISIONS,
  MONTH_NAMES,
  formatPeriod,
  getCurrentPeriod,
} from '#/lib/constants'
import type { ChecklistStatus } from '#/lib/types'
import {
  bulkUpdateChecklist,
  getTrackerData,
  updateChecklist,
} from '#/server/tracker'
import { useCanEditTracker } from '#/components/auth/auth-provider'
import { AppHeader } from '#/components/layout/app-header'
import { StatusSelect } from '#/components/status-select'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Progress } from '#/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Skeleton } from '#/components/ui/skeleton'
import { Textarea } from '#/components/ui/textarea'

export const Route = createFileRoute('/_app/tracker')({
  component: TrackerPage,
})

const TRACKER_PAGE_SIZE = 20

function TrackerPage() {
  const period = getCurrentPeriod()
  const [year, setYear] = useState(period.year)
  const [month, setMonth] = useState(period.month)
  const [division, setDivision] = useState('all')
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'completed' | 'pending' | 'not_started'
  >('all')
  const [search, setSearch] = useState('')
  const [trackerPage, setTrackerPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [bulkField, setBulkField] = useState('')
  const [bulkStatus, setBulkStatus] = useState<ChecklistStatus>('submitted')
  const canEdit = useCanEditTracker()
  const queryClient = useQueryClient()

  const years = [period.year - 1, period.year, period.year + 1]

  const { data, isLoading } = useQuery({
    queryKey: ['tracker', year, month, division, statusFilter, search],
    queryFn: () =>
      getTrackerData({
        data: {
          year,
          month,
          division: division === 'all' ? undefined : division,
          statusFilter,
          search: search || undefined,
        },
      }),
  })

  useEffect(() => { setTrackerPage(1) }, [year, month, division, statusFilter, search])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tracker'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const updateMut = useMutation({
    mutationFn: updateChecklist,
    onSuccess: () => {
      invalidate()
      toast.success('Updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const bulkMut = useMutation({
    mutationFn: bulkUpdateChecklist,
    onSuccess: (res) => {
      invalidate()
      setSelected(new Set())
      toast.success(`Updated ${res.updated} employees`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const fieldOptions = useMemo(() => {
    const builtIn = BUILT_IN_FIELDS.map((f) => ({
      id: f.key,
      label: f.label,
      isCustom: false,
    }))
    const custom = (data?.customFields ?? []).map((f) => ({
      id: f.id,
      label: f.label,
      isCustom: true,
    }))
    return [...builtIn, ...custom]
  }, [data?.customFields])

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      <AppHeader title="Tracker" />
      <main className="flex-1 space-y-4 p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Year</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Month</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {MONTH_NAMES[m - 1]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Division</Label>
            <Select value={division} onValueChange={setDivision}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All divisions</SelectItem>
                {DIVISIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(v as typeof statusFilter)
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="not_started">Not started</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px] flex-1">
            <Label className="text-xs">Search</Label>
            <Input
              placeholder="Name or employee code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {formatPeriod(year, month)}
        </p>

        {canEdit && selected.size > 0 && (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/40 p-3">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <Select value={bulkField} onValueChange={setBulkField}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Field" />
              </SelectTrigger>
              <SelectContent>
                {fieldOptions.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <StatusSelect value={bulkStatus} onChange={setBulkStatus} />
            <Button
              size="sm"
              disabled={!bulkField || bulkMut.isPending}
              onClick={() => {
                const field = fieldOptions.find((f) => f.id === bulkField)
                if (!field) return
                bulkMut.mutate({
                  data: {
                    year,
                    month,
                    employeeIds: Array.from(selected),
                    field: field.id,
                    status: bulkStatus,
                    isCustom: field.isCustom,
                  },
                })
              }}
            >
              Apply to selected
            </Button>
          </div>
        )}

        {isLoading || !data ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="space-y-3">
          <div className="space-y-2">
            {data.rows
              .slice(
                (trackerPage - 1) * TRACKER_PAGE_SIZE,
                trackerPage * TRACKER_PAGE_SIZE,
              )
              .map((row) => {
              const isOpen = expanded.has(row.employee.id)
              return (
                <Collapsible
                  key={row.employee.id}
                  open={isOpen}
                  onOpenChange={() => toggleExpand(row.employee.id)}
                  className="rounded-lg border bg-card"
                >
                  <div className="flex flex-wrap items-center gap-3 p-3">
                    {canEdit && (
                      <Checkbox
                        checked={selected.has(row.employee.id)}
                        onCheckedChange={() => toggleSelect(row.employee.id)}
                      />
                    )}
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <div className="min-w-[140px] flex-1">
                      <p className="font-medium">{row.employee.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.employee.employee_code}
                      </p>
                    </div>
                    <Badge variant="outline">{row.employee.division}</Badge>
                    <div className="flex flex-wrap gap-2">
                      {BUILT_IN_FIELDS.map((f) => (
                        <div key={f.key} className="flex flex-col gap-1">
                          <span className="text-[10px] text-muted-foreground">
                            {f.label}
                          </span>
                          <StatusSelect
                            value={
                              row.checklist?.[f.key] ?? 'not_yet_submitted'
                            }
                            disabled={!canEdit}
                            onChange={(status) =>
                              updateMut.mutate({
                                data: {
                                  year,
                                  month,
                                  employeeId: row.employee.id,
                                  field: f.key,
                                  status,
                                },
                              })
                            }
                          />
                        </div>
                      ))}
                      {data.customFields.map((cf) => (
                        <div key={cf.id} className="flex flex-col gap-1">
                          <span className="text-[10px] text-muted-foreground">
                            {cf.label}
                          </span>
                          <StatusSelect
                            value={
                              row.customValues[cf.id] ?? 'not_yet_submitted'
                            }
                            disabled={!canEdit}
                            onChange={(status) =>
                              updateMut.mutate({
                                data: {
                                  year,
                                  month,
                                  employeeId: row.employee.id,
                                  field: cf.id,
                                  status,
                                  isCustom: true,
                                },
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <div className="w-32">
                      <div className="mb-1 flex justify-between text-xs">
                        <span>Progress</span>
                        <span>{row.progress}%</span>
                      </div>
                      <Progress value={row.progress} />
                    </div>
                  </div>
                  <CollapsibleContent className="border-t px-4 pb-4 pt-3">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label className="text-xs">Notes</Label>
                        <Textarea
                          className="mt-1"
                          defaultValue={row.checklist?.notes ?? ''}
                          disabled={!canEdit}
                          onBlur={(e) =>
                            updateMut.mutate({
                              data: {
                                year,
                                month,
                                employeeId: row.employee.id,
                                field: 'notes',
                                notes: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2 text-sm">
                        <p>
                          <span className="text-muted-foreground">Position: </span>
                          {row.employee.position ?? '—'}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Email: </span>
                          {row.employee.email ?? '—'}
                        </p>
                        <div>
                          <Label className="text-xs">Progress override (%)</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            className="mt-1 w-24"
                            defaultValue={
                              row.checklist?.progress_override ?? ''
                            }
                            disabled={!canEdit}
                            onBlur={(e) => {
                              const v = e.target.value
                              updateMut.mutate({
                                data: {
                                  year,
                                  month,
                                  employeeId: row.employee.id,
                                  field: 'progress_override',
                                  progressOverride: v
                                    ? Number(v)
                                    : null,
                                },
                              })
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
            {data.rows.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">
                No employees match your filters.
              </p>
            )}
          </div>
          {data.rows.length > TRACKER_PAGE_SIZE && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing{' '}
                {(trackerPage - 1) * TRACKER_PAGE_SIZE + 1}–
                {Math.min(trackerPage * TRACKER_PAGE_SIZE, data.rows.length)} of{' '}
                {data.rows.length} employees
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={trackerPage <= 1}
                  onClick={() => setTrackerPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    trackerPage >= Math.ceil(data.rows.length / TRACKER_PAGE_SIZE)
                  }
                  onClick={() => setTrackerPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
          </div>
        )}
      </main>
    </>
  )
}
