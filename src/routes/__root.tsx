import { HeadContent, Link, Outlet, Scripts, createRootRouteWithContext, useRouterState } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import appCss from '@/styles.css?url'
import { useLiveConnection } from '@/live'
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
      <Button asChild><Link to="/watch">Back to Watch</Link></Button>
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

function Layout() {
  const { queryClient } = Route.useRouteContext()
  useLiveConnection(queryClient)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // The landing page is a standalone, full-screen page with no dashboard chrome.
  if (pathname === '/') return <Outlet />
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}
