import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { signOut } from '#/server/auth'
import { useAuth } from '#/components/auth/auth-provider'
import { SidebarTrigger } from '#/components/ui/sidebar'
import { ThemeToggle } from '#/components/theme-toggle'
import { Separator } from '#/components/ui/separator'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'

export function AppHeader({ title }: { title: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { refetch: refetchAuth } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    try {
      setIsSigningOut(true)
      await signOut()
      queryClient.clear()
      await refetchAuth()
      toast.success('Signed out successfully')
      await navigate({ to: '/login', replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sign out failed')
      setIsSigningOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      <h1 className="flex-1 text-lg font-semibold">{title}</h1>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <LogOut className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleSignOut} disabled={isSigningOut}>
              {isSigningOut ? 'Signing out…' : 'Sign out'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
