import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Database, FlaskConical } from 'lucide-react'
import { AlertsBell } from '@/components/alerts-bell'
import { demoEnabled } from '@/demo'
import { FlowMenu } from '@/components/flow-menu'
import { UserMenu } from '@/components/user-menu'
import { Crumbs, type Crumb } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'

/** Standard page frame: top bar, the next-step banner, then padded content. */
export function Page({ crumbs, children }: { crumbs: Crumb[]; children: ReactNode }) {
  const demo = useQuery({ queryKey: ['demo-mode'], queryFn: demoEnabled, staleTime: Infinity }).data
  return (
    <>
      <header className="no-print sticky top-0 z-10 flex h-16 w-full min-w-0 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
        <div className="min-w-0 flex-1 overflow-hidden [&_li]:whitespace-nowrap [&_ol]:flex-nowrap [&_li:last-child]:truncate"><Crumbs items={crumbs} /></div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Badge variant="warn" className="gap-1.5 py-1" title="Dry run: nothing is sent to any registrar, host, platform, telco or regulator. A person approves every notice.">
            <FlaskConical /><span className="max-sm:hidden">Dry run</span><span className="max-xl:hidden"> · nothing is sent</span>
          </Badge>
          {demo ? (
            <Badge variant="secondary" className="gap-1.5 py-1 max-md:hidden" title="No backend is connected, so this view runs on built-in sample data (a fictional brand).">
              <Database /> <span className="max-xl:hidden">Sample data</span>
            </Badge>
          ) : null}
          <AlertsBell />
          <FlowMenu />
          <UserMenu />
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-[88rem] grid-cols-[minmax(0,1fr)] gap-6 p-4 md:p-8">
        {children}
      </div>
    </>
  )
}
