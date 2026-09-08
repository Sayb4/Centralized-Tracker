import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ExportMenu } from '#/components/export/export-menu'
import { IncompleteReminderBanner } from '#/components/period/incomplete-reminder-banner'
import { PeriodLockBanner } from '#/components/period/period-lock-banner'
import { exportTrackerCsv, exportTrackerPdf } from '#/lib/export/tracker'
import {
  BUILT_IN_FIELDS,
  TRACKER_DEFAULT_WINDOW,
  filterCustomFieldsForWindow,
  formatPeriod,
  getTrackerWindow,
} from '#/lib/constants'
import { computeProgress, getStatusesForFields } from '#/lib/payroll'
import {
  parsePeriodSearch,
  parseTrackerStatusFilter,
  type TrackerStatusFilter,
} from '#/lib/search-params'
import type { ChecklistStatus } from '#/lib/types'
import { useDebouncedValue } from '#/hooks/use-debounced-value'
import { listDivisions } from '#/server/divisions'
import {
  bulkUpdateChecklist,
  exportTrackerData,
  getTrackerData,
  TRACKER_PAGE_SIZE,
  updateChecklist,
} from '#/server/tracker'
import {
  getPeriodContext,
  lockPeriod,
  unlockPeriod,
} from '#/server/periods'
import { useCanEditTracker } from '#/components/auth/auth-provider'
import { PeriodFilters } from '#/components/filters/period-filters'
import { AppHeader } from '#/components/layout/app-header'
import { TrackerRowList } from '#/components/tracker/tracker-row-list'
import { StatusSelect } from '#/components/status-select'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Skeleton } from '#/components/ui/skeleton'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_app/tracker/$windowId')({
  validateSearch: (search: Record<string, unknown>) => {
    const period = parsePeriodSearch(search)
    return {
      tab: (search.tab as string) || 'all',
      ...period,
      division: (search.division as string) || 'all',
      status: parseTrackerStatusFilter(search.status),
      q: (search.q as string) || '',
      page: Math.max(1, Number(search.page) || 1),
    }
  },
  beforeLoad: ({ params }) => {
    if (!getTrackerWindow(params.windowId)) {
      throw redirect({
        to: '/tracker/$windowId',
        params: { windowId: TRACKER_DEFAULT_WINDOW },
        search: { tab: 'all' },
      })
    }
  },
  component: TrackerWindowPage,
})

function TrackerWindowPage() {
  const { windowId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const window = getTrackerWindow(windowId)!

  const activeTab =
    window.tabs.find((t) => t.id === search.tab) ?? window.tabs[0]

  const { year, month, division, status: statusFilter, q, page: trackerPage } =
    search

  const [searchInput, setSearchInput] = useState(q)
  const debouncedSearch = useDebouncedValue(searchInput, 300)

  useEffect(() => {
    setSearchInput(q)
  }, [q])

  useEffect(() => {
    if (debouncedSearch === q) return
    navigate({
      search: (prev) => ({ ...prev, q: debouncedSearch, page: 1 }),
    })
  }, [debouncedSearch, q, navigate])

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkField, setBulkField] = useState('')
  const [bulkStatus, setBulkStatus] = useState<ChecklistStatus>('submitted')
  const [exporting, setExporting] = useState(false)
  const canEdit = useCanEditTracker()
  const queryClient = useQueryClient()

  const visibleBuiltInFields = useMemo(() => {
    return BUILT_IN_FIELDS.filter((f) => {
      if (!window.fieldKeys.includes(f.key)) return false
      if (activeTab.id === 'all') return true
      return activeTab.fields?.includes(f.key)
    })
  }, [window, activeTab])

  const { data, isLoading } = useQuery({
    queryKey: [
      'tracker',
      windowId,
      year,
      month,
      division,
      statusFilter,
      q,
      trackerPage,
    ],
    queryFn: () =>
      getTrackerData({
        data: {
          year,
          month,
          trackerWindow: windowId,
          division: division === 'all' ? undefined : division,
          statusFilter,
          search: q || undefined,
          page: trackerPage,
          pageSize: TRACKER_PAGE_SIZE,
        },
      }),
  })

  const { data: divisions = [] } = useQuery({
    queryKey: ['divisions'],
    queryFn: () => listDivisions(),
  })

  const { data: periodContext } = useQuery({
    queryKey: ['period-context', year, month, windowId],
    queryFn: () =>
      getPeriodContext({
        data: { year, month, trackerWindow: windowId },
      }),
  })

  const isLocked = periodContext?.isLocked ?? false
  const canEditPeriod = canEdit && !isLocked

  const lockMut = useMutation({
    mutationFn: lockPeriod,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['period-context'] })
      toast.success('Period closed')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const unlockMut = useMutation({
    mutationFn: unlockPeriod,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['period-context'] })
      toast.success('Period reopened')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  async function handleExport(format: 'csv' | 'pdf') {
    setExporting(true)
    try {
      const payload = await exportTrackerData({
        data: {
          year,
          month,
          trackerWindow: windowId,
          division: division === 'all' ? undefined : division,
          statusFilter,
          search: q || undefined,
        },
      })
      const exportOpts = {
        rows: payload.rows,
        trackerWindow: windowId,
        customFields: payload.customFields,
        year,
        month,
      }
      if (format === 'csv') exportTrackerCsv(exportOpts)
      else exportTrackerPdf(exportOpts)
      toast.success(`Exported ${payload.total} rows`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    setSelected(new Set())
    setBulkField('')
  }, [year, month, division, statusFilter, q, windowId, search.tab])

  const totalRows = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalRows / TRACKER_PAGE_SIZE))

  function patchSearch(
    patch: Partial<{
      year: number
      month: number
      division: string
      status: TrackerStatusFilter
      q: string
      page: number
      tab: string
    }>,
  ) {
    navigate({
      search: (prev) => ({
        ...prev,
        ...patch,
        page: patch.page ?? 1,
      }),
    })
  }

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

  const windowCustomFields = useMemo(
    () => filterCustomFieldsForWindow(data?.customFields ?? [], window.id),
    [data?.customFields, window.id],
  )

  const showCustomFields =
    activeTab.id === 'all' && windowCustomFields.length > 0

  const fieldOptions = useMemo(() => {
    const builtIn = visibleBuiltInFields.map((f) => ({
      id: f.key,
      label: f.label,
      isCustom: false,
    }))
    const custom = showCustomFields
      ? windowCustomFields.map((f) => ({
          id: f.id,
          label: f.label,
          isCustom: true,
        }))
      : []
    return [...builtIn, ...custom]
  }, [visibleBuiltInFields, showCustomFields, windowCustomFields])

  const rowsWithProgress = useMemo(() => {
    if (!data) return []
    return data.rows.map((row) => {
      const customStatuses = showCustomFields
        ? windowCustomFields.map(
            (cf) => row.customValues[cf.id] ?? 'not_yet_submitted',
          )
        : []
      const tabFieldKeys =
        activeTab.id === 'all'
          ? window.fieldKeys
          : (activeTab.fields ?? window.fieldKeys)
      const tabStatuses = getStatusesForFields(
        row.checklist,
        customStatuses,
        tabFieldKeys,
        showCustomFields && activeTab.id === 'all',
      )
      const progress = computeProgress(
        tabStatuses,
        activeTab.id === 'all' ? row.checklist?.progress_override : null,
      )
      return { ...row, progress }
    })
  }, [data, window, activeTab, showCustomFields, windowCustomFields])

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      <AppHeader title={`${window.label} Tracker`} />
      <main className="flex-1 space-y-4 p-6">
        <p className="text-sm text-muted-foreground">{window.description}</p>

        <div className="flex flex-wrap gap-2 border-b pb-1">
          {window.tabs.map((t) => (
            <Link
              key={t.id}
              to="/tracker/$windowId"
              params={{ windowId }}
              search={(prev) => ({ ...prev, tab: t.id })}
              className={cn(
                'rounded-t-md px-3 py-2 text-sm font-medium transition-colors',
                activeTab.id === t.id
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <PeriodFilters
            year={year}
            month={month}
            yearTriggerClassName="w-24"
            monthTriggerClassName="w-32"
            onYearChange={(y) => patchSearch({ year: y, page: 1 })}
            onMonthChange={(m) => patchSearch({ month: m, page: 1 })}
          />
          <div>
            <Label className="text-xs">Division</Label>
            <Select
              value={division}
              onValueChange={(v) => patchSearch({ division: v, page: 1 })}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All divisions</SelectItem>
                {divisions.map((d) => (
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
                patchSearch({ status: v as TrackerStatusFilter, page: 1 })
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
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <ExportMenu
            loading={exporting}
            onExportCsv={() => void handleExport('csv')}
            onExportPdf={() => void handleExport('pdf')}
          />
        </div>

        {periodContext && (
          <>
            <PeriodLockBanner
              year={year}
              month={month}
              isLocked={periodContext.isLocked}
              locking={lockMut.isPending || unlockMut.isPending}
              onLock={() => lockMut.mutate({ data: { year, month } })}
              onUnlock={() => unlockMut.mutate({ data: { year, month } })}
            />
            <IncompleteReminderBanner
              year={year}
              month={month}
              trackerWindow={windowId}
              incomplete={periodContext.incomplete}
              inProgress={periodContext.inProgress}
              notStarted={periodContext.notStarted}
            />
          </>
        )}

        <p className="text-sm text-muted-foreground">
          {formatPeriod(year, month)} · {activeTab.label}
        </p>

        {canEditPeriod && selected.size > 0 && (
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
            <TrackerRowList
              rows={rowsWithProgress}
              window={window}
              activeTabId={activeTab.id}
              visibleBuiltInFields={visibleBuiltInFields}
              windowCustomFields={windowCustomFields}
              showCustomFields={showCustomFields}
              year={year}
              month={month}
              canEdit={canEditPeriod}
              selected={selected}
              onToggleSelect={toggleSelect}
              updateMut={updateMut}
            />
            {totalRows > TRACKER_PAGE_SIZE && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(trackerPage - 1) * TRACKER_PAGE_SIZE + 1}–
                  {Math.min(trackerPage * TRACKER_PAGE_SIZE, totalRows)} of{' '}
                  {totalRows} employees
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={trackerPage <= 1}
                    onClick={() => patchSearch({ page: trackerPage - 1 })}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={trackerPage >= totalPages}
                    onClick={() => patchSearch({ page: trackerPage + 1 })}
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
