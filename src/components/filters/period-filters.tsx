import { MONTH_NAMES, getCurrentPeriod } from '#/lib/constants'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'

interface PeriodFiltersProps {
  year: number
  month: number
  onYearChange: (year: number) => void
  onMonthChange: (month: number) => void
  yearTriggerClassName?: string
  monthTriggerClassName?: string
}

export function PeriodFilters({
  year,
  month,
  onYearChange,
  onMonthChange,
  yearTriggerClassName = 'w-28',
  monthTriggerClassName = 'w-36',
}: PeriodFiltersProps) {
  const period = getCurrentPeriod()
  const years = [period.year - 1, period.year, period.year + 1]

  return (
    <>
      <div>
        <Label className="text-xs">Year</Label>
        <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
          <SelectTrigger className={yearTriggerClassName}>
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
        <Select value={String(month)} onValueChange={(v) => onMonthChange(Number(v))}>
          <SelectTrigger className={monthTriggerClassName}>
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
    </>
  )
}
