import { Fragment, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

export type Crumb = { label: string; to?: string; params?: Record<string, string> }

/** Breadcrumb trail for the app top bar. The last crumb is the current page. */
export function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((c, i) => (
          <Fragment key={`${c.label}-${i}`}>
            {i > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem>
              {c.to && i < items.length - 1 ? (
                <BreadcrumbLink asChild>
                  <Link to={c.to} params={c.params as never}>{c.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{c.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export function PageHeader({
  title, description, actions, mono,
}: { title: ReactNode; description?: ReactNode; actions?: ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="grid gap-2">
        <h1 className={mono ? 'font-mono text-[clamp(1.5rem,1.1rem+1.6vw,1.875rem)] font-bold tracking-tight break-all' : 'text-[clamp(1.75rem,1.2rem+2vw,2.25rem)] font-bold tracking-tight'}>{title}</h1>
        {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
