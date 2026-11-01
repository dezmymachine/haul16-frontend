import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, LogOut, Plus } from 'lucide-react'
import { api } from '@/api'
import { useSession } from '@/session'
import { useBrands } from '@/brand'
import { useApprover } from '@/ui'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const initialsOf = (s: string) => s.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

/** Top-right account: the business HAUL16 is protecting. The popover holds the approver name used on every notice decision. */
export function UserMenu() {
  const { brands, current, select } = useBrands()
  const [name, setName, locked] = useApprover()
  const { session } = useSession()
  const nav = useNavigate()
  const qc = useQueryClient()
  const signOut = async () => {
    await api.logout().catch(() => null)
    qc.clear()
    nav({ to: '/login' })
  }
  const business = current?.display_name ?? ''

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="Business account"
          className="flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Avatar className="size-9">
            <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">{initialsOf(business) || '…'}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-semibold sm:block">{business}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="grid gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">{initialsOf(business) || '…'}</AvatarFallback>
            </Avatar>
            <div className="grid leading-tight">
              <span className="font-semibold">{business}</span>
              <span className="text-xs text-muted-foreground">{current?.is_active ? 'Detection is watching this brand' : 'Brand in view'}</span>
            </div>
          </div>
          <div className="grid gap-1">
            <div className="text-xs font-medium text-muted-foreground">Brand</div>
            {brands.map((b) => (
              <button
                key={b.id}
                onClick={() => select(b.id)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <Check className={b.id === current?.id ? 'size-4 text-primary' : 'size-4 opacity-0'} />
                <span className="flex-1 truncate">{b.display_name}</span>
                {b.is_active ? <span className="text-xs text-muted-foreground">watching</span> : null}
              </button>
            ))}
            <Link to="/setup" search={{ new: true }} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"><Plus className="size-4" /> Add a brand</Link>
          </div>
          {locked ? (
            <div className="grid gap-2 rounded-md border bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground">Signed in as</div>
              <div className="text-sm font-medium">{session?.name} <span className="font-normal text-muted-foreground">{session?.email}</span></div>
              <p className="text-xs text-muted-foreground">Your name is recorded on every approval you make.</p>
              <Button variant="outline" size="sm" className="justify-start" onClick={signOut}><LogOut /> Sign out</Button>
            </div>
          ) : (
          <div className="grid gap-1.5">
            <Label htmlFor="acting-as">Acting as (approver)</Label>
            <Input id="acting-as" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
            <p className="text-xs text-muted-foreground">Recorded in the audit log whenever you approve, reject or file a notice.</p>
          </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
