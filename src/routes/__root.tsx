import { lazy, Suspense } from 'react'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import TanstackQueryProvider from '../integrations/tanstack-query/root-provider'
import { ThemeProvider } from '#/components/theme-provider'
import { AuthProvider } from '#/components/auth/auth-provider'
import { Toaster } from '#/components/ui/sonner'
import { TooltipProvider } from '#/components/ui/tooltip'
import appCss from '../styles.css?url'

import type { AuthState } from '#/lib/types'

const AppDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('#/components/dev/app-devtools').then((m) => ({
        default: m.AppDevtools,
      })),
    )
  : null

interface MyRouterContext {
  queryClient: QueryClient
  auth?: AuthState | null
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      {
        title: 'OCPDC Centralized Tracker —  Dashboard',
      },
      {
        name: 'description',
        content:
          'Track employee documentation and compliance checklists across monthly pay periods for OCPDC.',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
  errorComponent: RootError,
  notFoundComponent: RootNotFound,
})

function RootComponent() {
  return (
    <RootDocument>
      <TanstackQueryProvider>
        <ThemeProvider>
          <TooltipProvider>
            <AuthProvider>
              <Outlet />
              <Toaster richColors position="top-right" />
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </TanstackQueryProvider>
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        {AppDevtools ? (
          <Suspense fallback={null}>
            <AppDevtools />
          </Suspense>
        ) : null}
        <Scripts />
      </body>
    </html>
  )
}

function RootError({ error }: { error: Error }) {
  return (
    <RootDocument>
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-destructive">Something went wrong</h1>
          <p className="mt-2 text-muted-foreground">{error.message}</p>
        </div>
      </div>
    </RootDocument>
  )
}

function RootNotFound() {
  return (
    <RootDocument>
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Page not found</h1>
          <p className="mt-2 text-muted-foreground">
            The page you are looking for does not exist.
          </p>
        </div>
      </div>
    </RootDocument>
  )
}
