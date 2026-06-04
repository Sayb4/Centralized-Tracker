import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

let browserQueryClient: QueryClient | undefined

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1 },
    },
  })
}

export function getContext() {
  const queryClient =
    typeof window === 'undefined'
      ? makeQueryClient()
      : (browserQueryClient ??= makeQueryClient())

  return { queryClient }
}

export default function TanstackQueryProvider({
  children,
}: {
  children: ReactNode
}) {
  const [queryClient] = useState(() => makeQueryClient())
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
