import type { UseMutationResult } from '@tanstack/react-query'
import { BUILT_IN_FIELDS } from '#/lib/constants'
import type { BuiltInFieldKey, CustomChecklistField, TrackerWindow } from '#/lib/types'
import type { TrackerRow } from '#/server/tracker'
import { StatusSelect } from '#/components/status-select'
import { Label } from '#/components/ui/label'
import { Input } from '#/components/ui/input'
import { Progress } from '#/components/ui/progress'
import { Textarea } from '#/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'

type UpdateMut = UseMutationResult<
  { ok: boolean },
  Error,
  { data: Record<string, unknown> },
  unknown
>

interface TrackerEmployeeSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: (TrackerRow & { progress: number }) | null
  window: TrackerWindow
  activeTabId: string
  visibleBuiltInFields: (typeof BUILT_IN_FIELDS)[number][]
  windowCustomFields: CustomChecklistField[]
  showCustomFields: boolean
  year: number
  month: number
  canEdit: boolean
  updateMut: UpdateMut
}

export function TrackerEmployeeSheet({
  open,
  onOpenChange,
  row,
  window,
  activeTabId,
  visibleBuiltInFields,
  windowCustomFields,
  showCustomFields,
  year,
  month,
  canEdit,
  updateMut,
}: TrackerEmployeeSheetProps) {
  if (!row) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{row.employee.full_name}</SheetTitle>
          <SheetDescription>
            {row.employee.employee_code} · {row.employee.division}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span>Progress</span>
              <span className="font-medium">{row.progress}%</span>
            </div>
            <Progress value={row.progress} />
          </div>

          <div className="space-y-4">
            {visibleBuiltInFields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <StatusSelect
                  value={
                    row.checklist?.[f.key as BuiltInFieldKey] ??
                    'not_yet_submitted'
                  }
                  disabled={!canEdit || updateMut.isPending}
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

            {showCustomFields &&
              windowCustomFields.map((cf) => (
                <div key={cf.id} className="space-y-1">
                  <Label className="text-xs">{cf.label}</Label>
                  <StatusSelect
                    value={row.customValues[cf.id] ?? 'not_yet_submitted'}
                    disabled={!canEdit || updateMut.isPending}
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

          <div className="space-y-3 border-t pt-4">
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea
                className="mt-1"
                defaultValue={row.checklist?.notes ?? ''}
                disabled={!canEdit || updateMut.isPending}
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
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Position: </span>
                {row.employee.position ?? '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Email: </span>
                {row.employee.email ?? '—'}
              </p>
            </div>
            {window.id === 'payroll' && activeTabId === 'all' && (
              <div>
                <Label className="text-xs">Progress override (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="mt-1 w-24"
                  defaultValue={row.checklist?.progress_override ?? ''}
                  disabled={!canEdit || updateMut.isPending}
                  onBlur={(e) => {
                    const v = e.target.value
                    updateMut.mutate({
                      data: {
                        year,
                        month,
                        employeeId: row.employee.id,
                        field: 'progress_override',
                        progressOverride: v ? Number(v) : null,
                      },
                    })
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
