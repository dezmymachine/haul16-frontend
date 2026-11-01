import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/login')({
  head: () => ({ meta: [{ title: 'Sign in · HAUL16' }] }),
  component: LoginPage,
})

function LoginPage() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const login = useMutation({
    mutationFn: async () => {
      await api.login(email.trim(), password)
      // Where to land: setup until protection has started, otherwise Home.
      const brands = await api.brands().catch(() => [])
      if (!brands.length) return '/setup'
      const target = brands.find((b) => b.is_active) ?? brands[0]
      return (await api.setup(target.id).catch(() => null))?.complete ? '/home' : '/setup'
    },
    onSuccess: async (to) => {
      await qc.invalidateQueries()
      nav({ to: to as '/setup' | '/home' })
    },
  })

  return (
    <main className="grid min-h-svh place-items-center bg-background p-4">
      <div className="grid w-full max-w-sm gap-6">
        <Link to="/" className="text-xl font-extrabold tracking-tight text-foreground">HAUL16</Link>
        <div className="grid gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">Use the owner account for this HAUL16 workspace.</p>
        </div>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            login.mutate()
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {login.error ? <Alert variant="destructive"><AlertDescription>{(login.error as Error).message}</AlertDescription></Alert> : null}
          <Button type="submit" size="lg" disabled={login.isPending}>{login.isPending ? 'Signing in…' : 'Sign in'}</Button>
        </form>
      </div>
    </main>
  )
}
