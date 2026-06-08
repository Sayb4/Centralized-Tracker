import { createFileRoute, redirect, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { APP_NAME, usernameToEmail } from '#/lib/constants'
import { getSupabaseBrowserClient } from '#/lib/supabase/client'
import { getAuthState } from '#/server/auth'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    error: (search.error as string) || undefined,
  }),
  beforeLoad: async () => {
    const auth = await getAuthState()
    if (auth?.roles.includes('admin')) throw redirect({ to: '/dashboard' })
  },
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const { error: searchError } = useSearch({ from: '/login' })
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (searchError === 'admin_only') {
      toast.error('Access denied. This application is restricted to administrators only.')
    }
  }, [searchError])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const email = usernameToEmail(username)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        toast.error(error.message)
        return
      }
      const auth = await getAuthState()
      if (!auth?.roles.includes('admin')) {
        await supabase.auth.signOut()
        toast.error('Access denied. Administrator account required.')
        return
      }
      toast.success('Signed in successfully')
      await navigate({ to: '/dashboard' })
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
            OC
          </div>
          <CardTitle className="text-xl">{APP_NAME}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Administrator access only
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin login"
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
