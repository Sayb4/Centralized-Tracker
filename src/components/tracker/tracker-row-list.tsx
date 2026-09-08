import type { UseMutationResult } from '@tanstack/react-query'
import { useState } from 'react'
import { BUILT_IN_FIELDS } from '#/lib/constants'
import type { CustomChecklistField, TrackerWindow } from '#/lib/types'
import type { TrackerRow } from '#/server/tracker'
import { TrackerEmployeeSheet } from '#/components/tracker/tracker-employee-sheet'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import { Progress } from '#/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

type UpdateMut = UseMutationResult<
  { ok: boolean },
  Error,
  { data: Record<string, unknown> },
  unknown
>

interface TrackerRowListProps {
  rows: (TrackerRow & { progress: number })[]
  window: TrackerWindow
  activeTabId: string
  visibleBuiltInFields: (typeof BUILT_IN_FIELDS)[number][]
  windowCustomFields: CustomChecklistField[]
  showCustomFields: boolean
  year: number
  month: number
  canEdit: boolean
  selected: Set<string>
  onToggleSelect: (id: string) => void
  updateMut: UpdateMut
}

export function TrackerRowList({
  rows,
  window,
  activeTabId,
  visibleBuiltInFields,
  windowCustomFields,
  showCustomFields,
  year,
  month,
  canEdit,
  selected,
  onToggleSelect,
  updateMut,
}: TrackerRowListProps) {
  const [sheetRowId, setSheetRowId] = useState<string | null>(null)
  const sheetRow = rows.find((r) => r.employee.id === sheetRowId) ?? null

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        No employees match your filters.
      </p>
    )
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {canEdit && <TableHead className="w-10" />}
              <TableHead>Employee</TableHead>
              <TableHead>Division</TableHead>
              <TableHead className="w-40">Progress</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.employee.id}>
                {canEdit && (
                  <TableCell>
                    <Checkbox
                      checked={selected.has(row.employee.id)}
                      onCheckedChange={() => onToggleSelect(row.employee.id)}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <p className="font-medium">{row.employee.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.employee.employee_code}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{row.employee.division}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={row.progress} className="flex-1" />
                    <span className="w-10 text-right text-xs">
                      {row.progress}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSheetRowId(row.employee.id)}
                  >
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <div
            key={row.employee.id}
            className="flex items-center gap-3 rounded-lg border bg-card p-3"
          >
            {canEdit && (
              <Checkbox
                checked={selected.has(row.employee.id)}
                onCheckedChange={() => onToggleSelect(row.employee.id)}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{row.employee.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {row.employee.employee_code} · {row.employee.division}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Progress value={row.progress} className="flex-1" />
                <span className="text-xs font-medium">{row.progress}%</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSheetRowId(row.employee.id)}
            >
              Edit
            </Button>
          </div>
        ))}
      </div>

      <TrackerEmployeeSheet
        open={sheetRowId !== null}
        onOpenChange={(open) => {
          if (!open) setSheetRowId(null)
        }}
        row={sheetRow}
        window={window}
        activeTabId={activeTabId}
        visibleBuiltInFields={visibleBuiltInFields}
        windowCustomFields={windowCustomFields}
        showCustomFields={showCustomFields}
        year={year}
        month={month}
        canEdit={canEdit}
        updateMut={updateMut}
      />
    </>
  )
}
