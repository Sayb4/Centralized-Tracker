import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { ensureAdminAccess } from '#/server/auth'
import { AppSidebar } from '#/components/layout/app-sidebar'
import { SidebarInset, SidebarProvider } from '#/components/ui/sidebar'
import { Skeleton } from '#/components/ui/skeleton'

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const result = await ensureAdminAccess()
    if (!result.allowed) {
      throw redirect({
        to: '/login',
        search:
          result.reason === 'admin_only'
            ? { error: 'admin_only' }
            : undefined,
      })
    }
    return { auth: result.auth }
  },
  component: AppLayout,
  pendingComponent: AppLayoutPending,
})

function AppLayoutPending() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Skeleton className="h-8 w-48" />
    </div>
  )
}

function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex min-h-screen flex-col">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
