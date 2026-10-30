import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Building2, ClipboardCheck, FileBarChart, FolderOpen, Radar, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: 'HAUL16: brand takedown desk' }] }),
  component: HomePage,
})

function HomePage() {
  return (
    <main className="fixed inset-0 overflow-hidden bg-background">
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-4 p-4 md:p-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-1 lg:gap-6">
        <section className="flex flex-col gap-5 px-1 py-1 lg:min-h-0 lg:justify-between lg:gap-0 lg:px-6 lg:py-4">
          <header>
            <span className="text-xl font-extrabold tracking-tight">HAUL16</span>
          </header>

          <div className="grid max-w-xl gap-4 lg:gap-6">
            <h1 className="text-[clamp(2rem,1.3rem+3vw,3.5rem)] leading-[1.04] font-bold tracking-tight">
              One desk for faster brand takedowns.
              <span className="block text-muted-foreground/70">Spot, prove, approve.</span>
            </h1>
            <p className="max-w-md text-[clamp(0.95rem,0.9rem+0.25vw,1.125rem)] text-muted-foreground [@media(max-height:680px)]:hidden">
              Scam sites that copy your brand go live within hours and can take weeks to remove. HAUL16 spots look-alike
              domains the moment their certificate is issued, gathers the evidence, and prepares the takedown requests for you.
            </p>
            <div>
              <Button asChild size="lg" className="h-12 px-6 text-base">
                <Link to="/watch">
                  Open dashboard <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>

          <div className="hidden lg:block" />
        </section>

        <section aria-hidden="true" className="relative min-h-0 overflow-hidden rounded-xl border bg-[#eceafd] lg:rounded-2xl">
          <div className="absolute -top-24 -left-24 size-[28rem] rounded-full bg-primary/70 blur-3xl" />
          <div className="absolute top-1/3 -right-16 size-80 rounded-full bg-[#c18ad9]/80 blur-3xl" />
          <div className="absolute -bottom-24 left-1/4 size-96 rounded-full bg-[#d6ef3d]/70 blur-3xl" />
          <DashboardPreview />
        </section>
      </div>
    </main>
  )
}

const MENU = [
  { icon: Radar, label: 'Watch', active: true },
  { icon: ShieldAlert, label: 'Threats' },
  { icon: FolderOpen, label: 'Cases' },
  { icon: ClipboardCheck, label: 'Approvals', badge: '4' },
  { icon: FileBarChart, label: 'Report' },
  { icon: Building2, label: 'Brand' },
]
const BARS = [28, 46, 34, 62, 40, 74, 56]
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const NOTICES = [
  { host: 'nkwaex-airdrop.top', to: 'Cyber Security Authority', status: 'drafted' },
  { host: 'nkwaex-support.com', to: 'Google Safe Browsing', status: 'approved' },
  { host: 'nkwaex-support.com', to: 'Domain registrar', status: 'filed' },
]

/** A static miniature of the real dashboard, cropped by its frame like a product screenshot. */
function DashboardPreview() {
  return (
    <div className="absolute top-[9%] left-[6%] flex h-[95%] w-[135%] overflow-hidden rounded-xl border bg-card shadow-2xl shadow-primary/20 sm:top-[12%] sm:left-[9%] sm:h-[88%] sm:w-[118%]">
      <aside className="hidden w-44 shrink-0 content-start gap-1 border-r bg-card p-3 sm:grid">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[9px] font-extrabold text-primary-foreground">H16</span>
          <span className="text-sm font-extrabold">HAUL16</span>
        </div>
        {MENU.map((m) => (
          <div
            key={m.label}
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground',
              m.active && 'bg-accent font-semibold text-accent-foreground',
            )}
          >
            <m.icon className="size-3.5" />
            <span className="flex-1">{m.label}</span>
            {m.badge ? <span className="rounded-md bg-signal px-1.5 text-[10px] font-semibold text-white">{m.badge}</span> : null}
          </div>
        ))}
      </aside>

      <div className="grid min-w-0 flex-1 content-start gap-2.5 bg-background p-3 sm:gap-3 sm:p-4">
        <div>
          <div className="text-base font-bold sm:text-lg">Watch</div>
          <div className="text-[11px] text-muted-foreground">Look-alike sites matched against Nkwa Exchange, live.</div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            ['Threats tracked', '3', ''],
            ['Awaiting approval', '4', 'text-signal'],
            ['Filed (dry run)', '1', ''],
          ].map(([label, value, tone]) => (
            <div key={label} className="rounded-lg border bg-card p-3">
              <div className="text-[11px] text-muted-foreground">{label}</div>
              <div className={cn('text-2xl font-bold tabular-nums', tone)}>{value}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[1.4fr_1fr] gap-3">
          <div className="rounded-lg border bg-card p-3">
            <div className="mb-2 text-xs font-semibold">Matches this week</div>
            <div className="flex h-24 items-end gap-2">
              {BARS.map((h, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <div className="w-full rounded-sm bg-primary/80" style={{ height: `${h * 0.8}%` }} />
                  <span className="text-[9px] text-muted-foreground">{DAYS[i]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="mb-2 text-xs font-semibold">Threat mix</div>
            <div className="flex items-center gap-3">
              <div
                className="size-16 shrink-0 rounded-full"
                style={{ background: 'conic-gradient(#e0483a 0 67%, #b9b4e6 67% 100%)', mask: 'radial-gradient(circle, transparent 55%, #000 56%)' }}
              />
              <div className="grid gap-1 text-[10px] text-muted-foreground">
                <span><b className="text-foreground">2</b> high</span>
                <span><b className="text-foreground">1</b> low</span>
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-2 text-xs font-semibold">Takedown notices</div>
          <div className="grid gap-1.5">
            {NOTICES.map((n, i) => (
              <div key={i} className="flex items-center gap-3 rounded-md bg-muted/60 px-2.5 py-1.5 text-[11px]">
                <span className="font-mono">{n.host}</span>
                <span className="flex-1 text-muted-foreground">{n.to}</span>
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                    n.status === 'drafted' && 'bg-signal/10 text-signal',
                    n.status === 'approved' && 'bg-accent text-accent-foreground',
                    n.status === 'filed' && 'bg-ok text-ok-foreground',
                  )}
                >
                  {n.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
