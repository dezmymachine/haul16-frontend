import { useEffect } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Building2, ClipboardCheck, FileBarChart, FolderOpen, Radar, ShieldAlert } from 'lucide-react'
import { api } from '@/api'
import { useConnected, useCt } from '@/live'
import { cn } from '@/lib/utils'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar,
} from '@/components/ui/sidebar'

const NAV = [
  {
    label: 'Monitor',
    items: [
      { to: '/home', title: 'Home', icon: Radar },
      { to: '/threats', title: 'Threats', icon: ShieldAlert },
    ],
  },
  {
    label: 'Respond',
    items: [
      { to: '/cases', title: 'Cases', icon: FolderOpen },
      { to: '/approvals', title: 'Approvals', icon: ClipboardCheck, badge: true },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/report', title: 'Report', icon: FileBarChart },
      { to: '/brand', title: 'Brand', icon: Building2 },
    ],
  },
] as const

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { setOpenMobile } = useSidebar()

  // On mobile the sidebar is a sheet: close it once a route has been chosen.
  useEffect(() => {
    setOpenMobile(false)
  }, [pathname, setOpenMobile])
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats, refetchInterval: 10_000 })
  const awaiting = stats.data?.counts.notices_awaiting_approval ?? 0
  const connected = useConnected()
  const ct = useCt()

  const status = !connected ? 'offline' : ct?.status === 'live' ? 'live' : 'connected'

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/" className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0" aria-label="HAUL16 home">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-extrabold text-primary-foreground">
            H16
          </span>
          <span className="grid leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-lg font-extrabold tracking-tight text-foreground">HAUL16</span>
            <span className="truncate text-xs text-muted-foreground">Takedown desk</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {NAV.map((group) => (
          <SidebarGroup key={group.label} className="group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-3">
            <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground">{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = 'exact' in item ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`)
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                        className="h-11 gap-3 rounded-lg group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:[&>span]:hidden text-[15px] font-medium data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-accent-foreground [&>svg]:size-5"
                      >
                        <Link to={item.to}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      {'badge' in item && awaiting ? (
                        <SidebarMenuBadge className="rounded-md bg-signal text-white" title="notices awaiting approval">
                          {awaiting}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground" title={connected ? 'Live updates connected' : 'Reconnecting to the API'}>
          <span
            className={cn(
              'size-2 rounded-full',
              status === 'live' && 'animate-[pulse-dot_1.6s_ease-in-out_infinite] bg-emerald-500',
              status === 'connected' && 'bg-amber-500',
              status === 'offline' && 'bg-red-500',
            )}
          />
          <span className="group-data-[collapsible=icon]:hidden">{status === 'live' ? 'CT logs live' : status}</span>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
