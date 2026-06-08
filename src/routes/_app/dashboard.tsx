import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { PayrollGroupDetail } from '#/components/dashboard/payroll-group-detail'
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import {
  CHECKLIST_STATUS_LABELS,
  MONTH_NAMES,
  formatPeriod,
  getCurrentPeriod,
} from '#/lib/constants'
import type { ChecklistStatus } from '#/lib/types'
import { getDashboardData } from '#/server/dashboard'
import { AppHeader } from '#/components/layout/app-header'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

export const Route = createFileRoute('/_app/dashboard')({
  component: DashboardPage,
})

const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)']

function DashboardPage() {
  const period = getCurrentPeriod()
  const [year, setYear] = useState(period.year)
  const [month, setMonth] = useState(period.month)

  const years = [period.year - 1, period.year, period.year + 1]

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', year, month],
    queryFn: () => getDashboardData({ data: { year, month } }),
  })

  return (
    <>
      <AppHeader title="Dashboard" />
      <main className="flex-1 space-y-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Pay period</p>
            <h2 className="text-2xl font-semibold">
              {formatPeriod(year, month)}
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <div>
              <Label className="text-xs">Year</Label>
              <Select
                value={String(year)}
                onValueChange={(v) => setYear(Number(v))}
              >
                <SelectTrigger className="w-28">
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
              <Select
                value={String(month)}
                onValueChange={(v) => setMonth(Number(v))}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

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
              <StatCard label="Completed" value={data.stats.completed} />
              <StatCard label="In Progress" value={data.stats.inProgress} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Overall completion</CardTitle>
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
                <CardTitle className="text-base">Division summary</CardTitle>
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
                        <TableCell className="font-medium">{d.division}</TableCell>
                        <TableCell className="text-right">{d.employeeCount}</TableCell>
                        <TableCell className="text-right">{d.completed}</TableCell>
                        <TableCell className="text-right">{d.inProgress}</TableCell>
                        <TableCell className="text-right">{d.notStarted}</TableCell>
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

            <PayrollGroupDetail groups={data.payrollGroups} />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payroll groups summary</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Group</TableHead>
                      <TableHead className="text-right">Employees</TableHead>
                      <TableHead className="text-right">Completed</TableHead>
                      <TableHead className="text-right">In Progress</TableHead>
                      <TableHead className="text-right">Not Started</TableHead>
                      <TableHead>Avg Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.payrollGroups.map((g) => (
                      <TableRow key={g.group}>
                        <TableCell className="font-medium">{g.group}</TableCell>
                        <TableCell className="text-right">{g.employeeCount}</TableCell>
                        <TableCell className="text-right">{g.completed}</TableCell>
                        <TableCell className="text-right">{g.inProgress}</TableCell>
                        <TableCell className="text-right">{g.notStarted}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={g.averageProgress} className="flex-1" />
                            <span className="w-10 text-right text-xs">
                              {g.averageProgress}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
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
