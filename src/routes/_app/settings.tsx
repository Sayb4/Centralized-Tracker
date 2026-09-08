import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  TRACKER_DEFAULT_WINDOW,
  TRACKER_WINDOWS,
  labelToKey,
} from '#/lib/constants'
import type { CustomChecklistField, TrackerWindowId } from '#/lib/types'
import {
  createCustomField,
  deleteCustomField,
  listCustomFields,
  updateCustomField,
} from '#/server/settings'
import { useHasRole } from '#/components/auth/auth-provider'
import { AppHeader } from '#/components/layout/app-header'
import { ConfirmDialog } from '#/components/ui/confirm-dialog'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

export const Route = createFileRoute('/_app/settings')({
  component: SettingsPage,
})

function TrackerWindowPicker({
  value,
  onChange,
  disabled,
}: {
  value: TrackerWindowId[]
  onChange: (next: TrackerWindowId[]) => void
  disabled?: boolean
}) {
  function toggle(id: TrackerWindowId, checked: boolean) {
    if (checked) {
      onChange([...new Set([...value, id])])
      return
    }
    const next = value.filter((v) => v !== id)
    if (next.length === 0) {
      toast.error('At least one tracker must be selected')
      return
    }
    onChange(next)
  }

  return (
    <div className="flex flex-wrap gap-3">
      {TRACKER_WINDOWS.map((w) => (
        <label
          key={w.id}
          className="flex cursor-pointer items-center gap-2 text-sm"
        >
          <Checkbox
            checked={value.includes(w.id)}
            disabled={disabled}
            onCheckedChange={(checked) => toggle(w.id, checked === true)}
          />
          <span>{w.label}</span>
        </label>
      ))}
    </div>
  )
}

function SettingsPage() {
  const isAdmin = useHasRole('admin')
  const [newLabel, setNewLabel] = useState('')
  const [newTrackerWindows, setNewTrackerWindows] = useState<TrackerWindowId[]>([
    TRACKER_DEFAULT_WINDOW,
  ])
  const [deleteTarget, setDeleteTarget] = useState<CustomChecklistField | null>(
    null,
  )
  const queryClient = useQueryClient()

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ['custom-fields'],
    queryFn: () => listCustomFields(),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['custom-fields'] })

  const createMut = useMutation({
    mutationFn: createCustomField,
    onSuccess: () => {
      invalidate()
      setNewLabel('')
      setNewTrackerWindows([TRACKER_DEFAULT_WINDOW])
      toast.success('Field added')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const updateMut = useMutation({
    mutationFn: updateCustomField,
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: deleteCustomField,
    onSuccess: () => {
      invalidate()
      toast.success('Field deleted')
      setDeleteTarget(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <>
      <AppHeader title="Settings" />
      <main className="flex-1 space-y-6 p-6">
        <section>
          <h2 className="mb-2 text-lg font-semibold">Custom checklist fields</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Assign each custom field to one or more tracker windows. It will
            only appear on the &quot;All&quot; tab of the trackers you select.
          </p>
          {!isAdmin && (
            <p className="text-sm text-muted-foreground">
              Only administrators can manage custom fields.
            </p>
          )}

          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Trackers</TableHead>
                    <TableHead>Active</TableHead>
                    {isAdmin && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={isAdmin ? 5 : 4}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No custom fields yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    fields.map((field) => (
                      <TableRow key={field.id}>
                        <TableCell>
                          <Input
                            defaultValue={field.label}
                            disabled={!isAdmin}
                            onBlur={(e) => {
                              if (e.target.value !== field.label) {
                                updateMut.mutate({
                                  data: { id: field.id, label: e.target.value },
                                })
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {field.key}
                        </TableCell>
                        <TableCell>
                          {isAdmin ? (
                            <TrackerWindowPicker
                              value={field.tracker_windows}
                              onChange={(tracker_windows) =>
                                updateMut.mutate({
                                  data: { id: field.id, tracker_windows },
                                })
                              }
                            />
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {field.tracker_windows.map((id) => {
                                const window = TRACKER_WINDOWS.find(
                                  (w) => w.id === id,
                                )
                                return (
                                  <Badge key={id} variant="secondary">
                                    {window?.label ?? id}
                                  </Badge>
                                )
                              })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={field.active}
                            disabled={!isAdmin}
                            onCheckedChange={(active) =>
                              updateMut.mutate({ data: { id: field.id, active } })
                            }
                          />
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(field)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {isAdmin && (
            <div className="mt-4 space-y-3 rounded-lg border bg-muted/30 p-4">
              <div>
                <Label>New field label</Label>
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Field label"
                  className="mt-1 max-w-md"
                />
              </div>
              <div>
                <Label className="mb-2 block">Apply to trackers</Label>
                <TrackerWindowPicker
                  value={newTrackerWindows}
                  onChange={setNewTrackerWindows}
                />
              </div>
              <Button
                onClick={() => {
                  if (!newLabel.trim()) return
                  createMut.mutate({
                    data: {
                      label: newLabel.trim(),
                      key: labelToKey(newLabel),
                      tracker_windows: newTrackerWindows,
                    },
                  })
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add field
              </Button>
            </div>
          )}
        </section>

        <ConfirmDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
          title="Delete custom field?"
          description={`Delete "${deleteTarget?.label ?? 'this field'}"? All stored values will be lost.`}
          loading={deleteMut.isPending}
          onConfirm={() => {
            if (!deleteTarget) return
            deleteMut.mutate({ data: { id: deleteTarget.id } })
          }}
        />
      </main>
    </>
  )
}
