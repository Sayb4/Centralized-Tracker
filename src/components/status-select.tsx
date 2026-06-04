import {
  CHECKLIST_STATUSES,
  CHECKLIST_STATUS_LABELS,
} from '#/lib/constants'
import type { ChecklistStatus } from '#/lib/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'

export function StatusSelect({
  value,
  onChange,
  disabled,
}: {
  value: ChecklistStatus
  onChange: (v: ChecklistStatus) => void
  disabled?: boolean
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-8 w-[160px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CHECKLIST_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {CHECKLIST_STATUS_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
