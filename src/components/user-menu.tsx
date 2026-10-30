import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { api } from '@/api'
import { useApprover } from '@/ui'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const initialsOf = (s: string) => s.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

/** Top-right account: the business HAUL16 is protecting. The popover holds the approver name used on every notice decision. */
export function UserMenu() {
  const brand = useQuery({ queryKey: ['brand'], queryFn: api.brand })
  const [name, setName] = useApprover()
  const business = brand.data?.display_name ?? ''

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
              <span className="text-xs text-muted-foreground">Brand under protection</span>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="acting-as">Acting as (approver)</Label>
            <Input id="acting-as" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
            <p className="text-xs text-muted-foreground">Recorded in the audit log whenever you approve, reject or file a notice.</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
