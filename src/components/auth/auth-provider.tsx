import { useQuery } from '@tanstack/react-query'
import { createContext, useContext, type ReactNode } from 'react'
import { getAuthState } from '#/server/auth'
import type { AuthState } from '#/lib/types'

interface AuthContextValue {
  auth: AuthState | null
  isLoading: boolean
  refetch: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['auth'],
    queryFn: () => getAuthState(),
    staleTime: 60_000,
  })

  return (
    <AuthContext.Provider
      value={{ auth: data ?? null, isLoading, refetch: () => void refetch() }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function useHasRole(role: AuthState['roles'][number]) {
  const { auth } = useAuth()
  return auth?.roles.includes(role) ?? false
}

export function useCanEditTracker() {
  const { auth } = useAuth()
  return auth?.roles.includes('admin') ?? false
}

export function useCanManageEmployees() {
  const { auth } = useAuth()
  return auth?.roles.includes('admin') ?? false
}
