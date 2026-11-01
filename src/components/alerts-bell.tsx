import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { api, type AlertItem } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : `${Math.floor(s / 86400)} d ago`
}
const SEV: Record<AlertItem['severity'], 'high' | 'medium' | 'secondary'> = { high: 'high', medium: 'medium', info: 'secondary' }

/** Top-bar bell: what HAUL16 wants you to know, newest first. Unread count refreshes every 15 seconds and on live events. */
export function AlertsBell() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['alerts'], queryFn: api.alerts, refetchInterval: 15_000 })
  const read = useMutation({
    mutationFn: (ids?: number[]) => api.alertsRead(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  })
  const unread = q.data?.unread ?? 0
  const items = q.data?.items ?? []
  return (
    <Popover onOpenChange={(open) => open && q.refetch()}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" aria-label={unread ? `Alerts, ${unread} unread` : 'Alerts'} className="no-print relative">
          <Bell />
          {unread ? <span className="absolute -top-1.5 -right-1.5 flex min-w-5 items-center justify-center rounded-md bg-signal px-1 text-[11px] font-semibold text-white">{unread > 99 ? '99+' : unread}</span> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="font-semibold">Alerts</div>
          <Button variant="ghost" size="sm" disabled={!unread || read.isPending} onClick={() => read.mutate(undefined)}><CheckCheck /> Mark all read</Button>
        </div>
        <ScrollArea className="max-h-96">
          {items.length ? (
            <ul>
              {items.map((a) => (
                <li key={a.id} className={cn('border-b last:border-b-0', !a.read_at && 'bg-accent/50')}>
                  <Link to={(a.href ?? '/home') as never} onClick={() => !a.read_at && read.mutate([a.id])} className="grid gap-1 px-4 py-3 text-foreground hover:bg-accent">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium">{a.title}</span>
                      <Badge variant={SEV[a.severity]} className="shrink-0">{a.severity}</Badge>
                    </span>
                    {a.detail ? <span className="line-clamp-2 text-xs text-muted-foreground">{a.detail}</span> : null}
                    <span className="text-xs text-muted-foreground">{ago(a.created_at)}{Object.keys(a.delivered ?? {}).length ? ` · sent to ${Object.keys(a.delivered).join(', ')}` : ''}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-sm text-muted-foreground">Nothing yet. When HAUL16 finds a look-alike, confirms a takedown or finishes a scan that found something, it shows up here.</p>
          )}
        </ScrollArea>
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">Get these by email or Slack in <Link to="/settings">Settings</Link>.</div>
      </PopoverContent>
    </Popover>
  )
}
