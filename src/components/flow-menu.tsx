import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Scale } from 'lucide-react'
import { api } from '@/api'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/** The takedown pipeline as a top-bar menu: four steps with live counts, one click to each. */
export function FlowMenu() {
  const [open, setOpen] = useState(false)
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats, refetchInterval: 10_000 })
  const c = stats.data?.counts
  const awaiting = c?.notices_awaiting_approval ?? 0
  const steps = [
    { to: '/threats', label: 'Review matches', n: c?.threats ?? 0 },
    { to: '/cases', label: 'Check cases', n: c?.open_cases ?? 0 },
    { to: '/approvals', label: 'Approve notices', n: awaiting, hot: awaiting > 0 },
    { to: '/report', label: 'Report removals', n: c?.notices_filed ?? 0 },
  ] as const

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="no-print gap-2" aria-label="Takedown flow">
          <Scale className="text-primary" />
          <span className="max-md:hidden">Takedown flow</span>
          {awaiting ? <Badge variant="warn" className="px-1.5">{awaiting}</Badge> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
          <Scale className="size-4" /> Takedown flow
        </div>
        <ol className="grid gap-1">
          {steps.map((st, i) => (
            <li key={st.to}>
              <Link
                to={st.to}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-2 rounded-md bg-muted px-2.5 py-2 text-sm font-medium text-foreground hover:bg-accent',
                  'hot' in st && st.hot && 'bg-accent text-accent-foreground',
                )}
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-background text-[11px] font-semibold text-primary">{i + 1}</span>
                <span className="flex-1">{st.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{st.n}</span>
              </Link>
            </li>
          ))}
        </ol>
      </PopoverContent>
    </Popover>
  )
}
