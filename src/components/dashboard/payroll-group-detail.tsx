import { useEffect, useMemo, useState } from 'react'
import type { DashboardGroupMember } from '#/server/dashboard'
import { CHECKLIST_STATUS_LABELS } from '#/lib/constants'
import type { ChecklistStatus } from '#/lib/types'
import { Badge } from '#/components/ui/badge'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

interface PayrollGroupSummary {
  group: string
  employeeCount: number
  averageProgress: number
  members: DashboardGroupMember[]
}

function categoryLabel(category: DashboardGroupMember['category']) {
  if (category === 'completed') return 'Completed'
  if (category === 'in_progress') return 'In Progress'
  return 'Not Started'
}

function categoryVariant(
  category: DashboardGroupMember['category'],
): 'default' | 'secondary' | 'outline' {
  if (category === 'completed') return 'default'
  if (category === 'in_progress') return 'secondary'
  return 'outline'
}

function statusBadgeVariant(
  status: ChecklistStatus,
): 'default' | 'secondary' | 'outline' {
  if (status === 'completed') return 'default'
  if (status === 'submitted') return 'secondary'
  if (status === 'not_needed') return 'outline'
  return 'outline'
}

export function PayrollGroupDetail({
  groups,
}: {
  groups: PayrollGroupSummary[]
}) {
  const [selectedGroup, setSelectedGroup] = useState<string>('')

  useEffect(() => {
    if (groups.length === 0) return
    if (!selectedGroup || !groups.some((g) => g.group === selectedGroup)) {
      setSelectedGroup(groups[0].group)
    }
  }, [groups, selectedGroup])

  const selected = useMemo(
    () => groups.find((g) => g.group === selectedGroup),
    [groups, selectedGroup],
  )

  const fieldColumns = useMemo(
    () => selected?.members[0]?.fields ?? [],
    [selected],
  )

  if (groups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payroll group members</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No payroll groups found for this period.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Payroll group members</CardTitle>
        <div className="w-full sm:w-72">
          <Label className="text-xs text-muted-foreground">Payroll group</Label>
          <Select
            value={selectedGroup}
            onValueChange={setSelectedGroup}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select a group" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.group} value={g.group}>
                  {g.group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {selected && (
          <>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span>
                <span className="text-muted-foreground">Employees: </span>
                <span className="font-medium">{selected.employeeCount}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">Avg progress:</span>
                <Progress
                  value={selected.averageProgress}
                  className="h-2 w-24"
                />
                <span className="font-medium">{selected.averageProgress}%</span>
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Employee</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Overall</TableHead>
                    <TableHead>Progress</TableHead>
                    {fieldColumns.map((f) => (
                      <TableHead key={f.key} className="min-w-[120px] text-xs">
                        {f.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.members.map((member) => (
                    <TableRow key={member.employeeId}>
                      <TableCell className="font-medium">
                        {member.fullName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.employeeCode}
                      </TableCell>
                      <TableCell>
                        <Badge variant={categoryVariant(member.category)}>
                          {categoryLabel(member.category)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={member.progress}
                            className="h-2 w-16"
                          />
                          <span className="text-xs">{member.progress}%</span>
                        </div>
                      </TableCell>
                      {member.fields.map((field) => (
                        <TableCell key={field.key}>
                          <Badge
                            variant={statusBadgeVariant(field.status)}
                            className="whitespace-nowrap text-[10px] font-normal"
                          >
                            {CHECKLIST_STATUS_LABELS[field.status]}
                          </Badge>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {selected.members.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4 + fieldColumns.length}
                        className="text-center text-muted-foreground"
                      >
                        No employees in this group.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
