import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { PayrollGroupDetail } from '#/components/dashboard/payroll-group-detail'
import { DashboardStatLink } from '#/components/dashboard/dashboard-stat-link'
import { IncompleteReminderBanner } from '#/components/period/incomplete-reminder-banner'
import { PeriodLockBanner } from '#/components/period/period-lock-banner'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  CHECKLIST_STATUS_LABELS,
  TRACKER_DEFAULT_WINDOW,
  TRACKER_WINDOWS,
  formatPeriod,
} from '#/lib/constants'
import {
  parsePeriodSearch,
  parseTrackerWindowSearch,
} from '#/lib/search-params'
import type { ChecklistStatus } from '#/lib/types'
import { getDashboardData } from '#/server/dashboard'
import {
  getPeriodContext,
  lockPeriod,
  unlockPeriod,
} from '#/server/periods'
import { trackerRouteTo, trackerSearchFromDashboard } from '#/lib/tracker-links'
import { toast } from 'sonner'
import { PeriodFilters } from '#/components/filters/period-filters'
import { TrackerWindowSelect } from '#/components/filters/tracker-window-select'
import { AppHeader } from '#/components/layout/app-header'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Progress } from '#/components/ui/progress'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

export const Route = createFileRoute('/_app/dashboard')({
  validateSearch: (search: Record<string, unknown>) => {
    const period = parsePeriodSearch(search)
    return {
      ...period,
      tracker: parseTrackerWindowSearch(search, TRACKER_DEFAULT_WINDOW),
    }
  },
  component: DashboardPage,
})

const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)']

const PAYROLL_GROUP_BAR_COLORS = {
  Completed: 'var(--chart-1)',
  'In Progress': 'var(--chart-2)',
  'Not Started': 'var(--chart-3)',
} as const

function DashboardPage() {
  const { year, month, tracker: trackerWindow } = Route.useSearch()
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const selectedTracker = TRACKER_WINDOWS.find((w) => w.id === trackerWindow)
  const isPayrollTracker = trackerWindow === 'payroll'

  const trackerLinkSearch = (
    patch: Partial<Parameters<typeof trackerSearchFromDashboard>[0]>,
  ) =>
    trackerSearchFromDashboard({
      year,
      month,
      trackerWindow,
      ...patch,
    })

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', year, month, trackerWindow],
    queryFn: () =>
      getDashboardData({ data: { year, month, trackerWindow } }),
  })

  const { data: periodContext } = useQuery({
    queryKey: ['period-context', year, month, trackerWindow],
    queryFn: () =>
      getPeriodContext({
        data: { year, month, trackerWindow },
      }),
  })

  const lockMut = useMutation({
    mutationFn: lockPeriod,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['period-context'] })
      toast.success('Period closed — checklist edits are now locked')
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

  return (
    <>
      <AppHeader title="Dashboard" />
      <main className="flex-1 space-y-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {selectedTracker?.label ?? 'Tracker'} · {formatPeriod(year, month)}
            </p>
            <h2 className="text-2xl font-semibold">Dashboard</h2>
            {selectedTracker && (
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedTracker.description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <TrackerWindowSelect
              value={trackerWindow}
              onValueChange={(v) =>
                navigate({ search: (prev) => ({ ...prev, tracker: v }) })
              }
            />
            <PeriodFilters
              year={year}
              month={month}
              onYearChange={(y) =>
                navigate({ search: (prev) => ({ ...prev, year: y }) })
              }
              onMonthChange={(m) =>
                navigate({ search: (prev) => ({ ...prev, month: m }) })
              }
            />
          </div>
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
              trackerWindow={trackerWindow}
              incomplete={periodContext.incomplete}
              inProgress={periodContext.inProgress}
              notStarted={periodContext.notStarted}
            />
          </>
        )}

        {isLoading || !data ? (
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard label="Total Employees" value={data.stats.total} />
              <StatCard label="Active" value={data.stats.active} />
              <DashboardStatLink
                label="Completed"
                value={data.stats.completed}
                {...trackerRouteTo(trackerWindow)}
                search={trackerLinkSearch({ status: 'completed' })}
              />
              <DashboardStatLink
                label="In Progress"
                value={data.stats.inProgress}
                {...trackerRouteTo(trackerWindow)}
                search={trackerLinkSearch({ status: 'pending' })}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {data.trackerLabel} completion
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Average progress</span>
                  <span className="font-medium">{data.averageProgress}%</span>
                </div>
                <Progress value={data.averageProgress} />
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Completion distribution</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.completionPie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {data.completionPie.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Status distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.statusDistribution.map((row) => (
                        <TableRow key={row.status}>
                          <TableCell>
                            {CHECKLIST_STATUS_LABELS[row.status as ChecklistStatus]}
                          </TableCell>
                          <TableCell className="text-right">{row.count}</TableCell>
                          <TableCell className="text-right">
                            {row.percentage}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Division summary · {data.trackerLabel}
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Division</TableHead>
                      <TableHead className="text-right">Employees</TableHead>
                      <TableHead className="text-right">Completed</TableHead>
                      <TableHead className="text-right">In Progress</TableHead>
                      <TableHead className="text-right">Not Started</TableHead>
                      <TableHead>Avg Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.divisionSummary.map((d) => (
                      <TableRow key={d.division}>
                        <TableCell className="font-medium">
                          <Link
                            {...trackerRouteTo(trackerWindow)}
                            search={trackerLinkSearch({ division: d.division })}
                            className="hover:text-primary hover:underline"
                          >
                            {d.division}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">{d.employeeCount}</TableCell>
                        <TableCell className="text-right">
                          <Link
                            {...trackerRouteTo(trackerWindow)}
                            search={trackerLinkSearch({
                              division: d.division,
                              status: 'completed',
                            })}
                            className="hover:text-primary hover:underline"
                          >
                            {d.completed}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            {...trackerRouteTo(trackerWindow)}
                            search={trackerLinkSearch({
                              division: d.division,
                              status: 'pending',
                            })}
                            className="hover:text-primary hover:underline"
                          >
                            {d.inProgress}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            {...trackerRouteTo(trackerWindow)}
                            search={trackerLinkSearch({
                              division: d.division,
                              status: 'not_started',
                            })}
                            className="hover:text-primary hover:underline"
                          >
                            {d.notStarted}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={d.averageProgress} className="flex-1" />
                            <span className="w-10 text-right text-xs">
                              {d.averageProgress}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {isPayrollTracker && (
              <>
                <PayrollGroupDetail
                  groups={data.payrollGroups}
                  year={year}
                  month={month}
                  trackerWindow={trackerWindow}
                />

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Payroll groups · {data.trackerLabel}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-80">
                    {data.payrollGroups.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No payroll groups found for this period.
                      </p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.payrollGroups.map((g) => ({
                            group: g.group,
                            Completed: g.completed,
                            'In Progress': g.inProgress,
                            'Not Started': g.notStarted,
                            averageProgress: g.averageProgress,
                            employeeCount: g.employeeCount,
                          }))}
                          margin={{ top: 8, right: 8, left: 0, bottom: 24 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis
                            dataKey="group"
                            tick={{ fontSize: 11 }}
                            interval={0}
                            angle={-25}
                            textAnchor="end"
                            height={70}
                          />
                          <YAxis allowDecimals={false} />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null
                              const row = payload[0]?.payload as {
                                employeeCount: number
                                averageProgress: number
                              }
                              return (
                                <div className="rounded-lg border bg-background p-3 text-sm shadow-md">
                                  <p className="font-medium">{label}</p>
                                  <p className="text-muted-foreground">
                                    Employees: {row.employeeCount}
                                  </p>
                                  <p>Avg progress: {row.averageProgress}%</p>
                                  {payload.map((entry) => (
                                    <p
                                      key={entry.name}
                                      style={{ color: entry.color }}
                                    >
                                      {entry.name}: {entry.value}
                                    </p>
                                  ))}
                                </div>
                              )
                            }}
                          />
                          <Legend />
                          <Bar
                            dataKey="Completed"
                            stackId="groups"
                            fill={PAYROLL_GROUP_BAR_COLORS.Completed}
                          />
                          <Bar
                            dataKey="In Progress"
                            stackId="groups"
                            fill={PAYROLL_GROUP_BAR_COLORS['In Progress']}
                          />
                          <Bar
                            dataKey="Not Started"
                            stackId="groups"
                            fill={PAYROLL_GROUP_BAR_COLORS['Not Started']}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </main>
    </>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}
