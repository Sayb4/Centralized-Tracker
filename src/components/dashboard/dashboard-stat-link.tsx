import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { cn } from '#/lib/utils'

interface DashboardStatLinkProps {
  label: string
  value: number
  to: string
  params?: Record<string, string>
  search?: Record<string, unknown>
  className?: string
}

export function DashboardStatLink({
  label,
  value,
  to,
  params,
  search,
  className,
}: DashboardStatLinkProps) {
  return (
    <Link
      to={to}
      params={params}
      search={search}
      className={cn('block transition-opacity hover:opacity-90', className)}
    >
      <Card className="h-full cursor-pointer hover:border-primary/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{value}</p>
        </CardContent>
      </Card>
    </Link>
  )
}
