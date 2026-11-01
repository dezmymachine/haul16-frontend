import { HeadContent, Link, Outlet, Scripts, createRootRouteWithContext, useNavigate, useRouterState } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import appCss from '@/styles.css?url'
import { useLiveConnection } from '@/live'
import { useSession } from '@/session'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'HAUL16 Takedown Desk' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap',
      },
    ],
  }),
  shellComponent: RootDocument,
  component: Layout,
  notFoundComponent: () => (
    <div className="grid place-items-center gap-3 p-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Button asChild><Link to="/home">Back to Home</Link></Button>
    </div>
  ),
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" style={{ colorScheme: 'light' }}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

const PUBLIC = ['/', '/login']

function Layout() {
  const { queryClient } = Route.useRouteContext()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { isPending, signedOut } = useSession()
  const isPublic = PUBLIC.includes(pathname)
  const { session } = useSession()
  useLiveConnection(queryClient, !isPublic && !!session)   // no live stream until someone is signed in
  useEffect(() => {
    if (!isPublic && signedOut) navigate({ to: '/login' })
  }, [isPublic, signedOut, navigate])

  // The providers are unconditional: during a route change the page that is leaving still renders for a moment, and it may need them.
  // Landing and sign-in are standalone; setup is full-screen with no sidebar; everything else gets the sidebar.
  const standalone = isPublic || pathname === '/setup'
  const gated = !isPublic && (isPending || signedOut)
  return (
    <TooltipProvider>
      <SidebarProvider>
        {gated ? null : standalone ? <div className="min-w-0 flex-1"><Outlet /></div> : (
          <>
            <AppSidebar />
            <SidebarInset className="min-w-0"><Outlet /></SidebarInset>
          </>
        )}
      </SidebarProvider>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}
