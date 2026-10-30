import { useState, type ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Database, Eye, FlaskConical, X } from 'lucide-react'
import { api } from '@/api'
import { demoEnabled } from '@/demo'
import { FlowMenu } from '@/components/flow-menu'
import { UserMenu } from '@/components/user-menu'
import { Crumbs, type Crumb } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'

const dismissed = new Set<string>()

/** The one thing a person should do next, taken from live counts. Dismissible for the session. */
function NextStep() {
  const path = useRouterState({ select: (s) => s.location.pathname })
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats, refetchInterval: 10_000 })
  const [, bump] = useState(0)
  const c = stats.data?.counts
  if (!c || path.startsWith('/approvals')) return null
  const msg = c.notices_awaiting_approval
    ? { key: `approve-${c.notices_awaiting_approval}`, text: `${c.notices_awaiting_approval} takedown notices are waiting for your approval`, to: '/approvals', cta: 'Review notices' }
    : c.open_cases && !c.notices_filed
      ? { key: 'cases', text: 'Approved notices can be filed from the case page to start the takedown clock', to: '/cases', cta: 'Open cases' }
      : null
  if (!msg || dismissed.has(msg.key)) return null
  return (
    <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-accent px-4 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Eye className="size-5" /></span>
      <p className="min-w-[14rem] flex-1 text-[15px] font-medium">{msg.text}</p>
      <Button asChild size="lg" className="bg-sky-200 text-sky-950 hover:bg-sky-300">
        <Link to={msg.to}>{msg.cta} <ArrowRight /></Link>
      </Button>
      <button
        aria-label="Dismiss"
        className="rounded-md p-1 text-foreground/70 hover:bg-primary/10"
        onClick={() => {
          dismissed.add(msg.key)
          bump((n) => n + 1)
        }}
      >
        <X className="size-5" />
      </button>
    </div>
  )
}

/** Standard page frame: top bar, the next-step banner, then padded content. */
export function Page({ crumbs, children }: { crumbs: Crumb[]; children: ReactNode }) {
  const demo = useQuery({ queryKey: ['demo-mode'], queryFn: demoEnabled, staleTime: Infinity }).data
  return (
    <>
      <header className="no-print sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
        <div className="min-w-0 flex-1 overflow-hidden [&_li]:whitespace-nowrap [&_ol]:flex-nowrap [&_li:last-child]:truncate"><Crumbs items={crumbs} /></div>
        <Badge variant="warn" className="gap-1.5 py-1" title="Nothing is sent to any registrar, host, platform, telco or regulator. A person approves every notice.">
          <FlaskConical /> Dry run<span className="max-lg:hidden"> · nothing is sent</span>
        </Badge>
        {demo ? (
          <Badge variant="secondary" className="gap-1.5 py-1" title="No backend is connected, so this view runs on built-in sample data (a fictional brand).">
            <Database /> <span className="max-md:hidden">Sample data</span>
          </Badge>
        ) : null}
        <FlowMenu />
        <UserMenu />
      </header>
      <div className="mx-auto grid w-full max-w-[88rem] grid-cols-[minmax(0,1fr)] gap-6 p-4 md:p-8">
        <NextStep />
        {children}
      </div>
    </>
  )
}
