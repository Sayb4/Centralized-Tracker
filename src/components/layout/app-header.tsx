import { SidebarTrigger } from '#/components/ui/sidebar'
import { ThemeToggle } from '#/components/theme-toggle'
import { Separator } from '#/components/ui/separator'

export function AppHeader({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      <h1 className="flex-1 text-lg font-semibold">{title}</h1>
      <ThemeToggle />
    </header>
  )
}
