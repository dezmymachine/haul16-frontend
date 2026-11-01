import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Area, AreaChart, Cell, Pie, PieChart, XAxis } from 'recharts'
import { ArrowRight, Check, ClipboardCheck, FolderOpen, Hourglass, Loader2, Radio, Send, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { api, type NextAction, type SweepStatus } from '@/api'
import { useBrands } from '@/brand'
import { useCt, useFeed, useRate, type FeedItem } from '@/live'
import { ConfidenceChip, Empty, ErrorNote, Reason, fmtDuration } from '@/ui'
import { Page } from '@/components/page'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { ScanSources } from '@/components/scan-sources'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export const Route = createFileRoute('/home')({ component: HomePage })

const rateConfig = { rate: { label: 'Certificates / s', color: 'var(--chart-1)' } } satisfies ChartConfig

function HomePage() {
  const { current: brand, isPending: loadingBrands } = useBrands()
  const nav = useNavigate()
  const ct = useCt()
  const rate = useRate()
  const bid = brand?.id
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats, refetchInterval: 10_000, enabled: !!bid })
  const setup = useQuery({
    queryKey: ['setup', bid], queryFn: () => api.setup(bid!), enabled: !!bid,
    refetchInterval: (q) => (q.state.data?.sweep.status === 'running' || q.state.data?.steps.profile.running ? 2000 : 10_000),
  })
  const c = stats.data?.counts
  const live = ct ?? stats.data?.ct
  const isLive = live?.status === 'live'

  // A brand that has not started protection belongs in setup, not on a dashboard.
  useEffect(() => {
    if (!loadingBrands && !brand) nav({ to: '/setup', replace: true })
    else if (setup.data && !setup.data.complete) nav({ to: '/setup', replace: true })
  }, [loadingBrands, brand, setup.data, nav])

  if (!brand || !setup.data) return <Page crumbs={[{ label: 'Home' }]}><Skeleton className="h-64 w-full" /></Page>
  const s = setup.data

  return (
    <Page crumbs={[{ label: 'Home' }]}>
      <PageHeader title={brand.display_name} description="What needs you, and what HAUL16 has found." />

      <NextStepCard action={s.next_action} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-6 md:grid-cols-[17rem_minmax(0,1fr)]">
          <MetricList
            items={[
              { icon: ShieldAlert, label: 'Threats tracked', value: c?.threats, to: '/threats' },
              { icon: FolderOpen, label: 'Open cases', value: c?.open_cases, to: '/cases' },
              { icon: ClipboardCheck, label: 'Awaiting approval', value: c?.notices_awaiting_approval, to: '/approvals', hot: !!c?.notices_awaiting_approval },
              { icon: Send, label: 'Filed', value: c?.notices_filed, to: '/approvals?status=filed_dry_run' },
              { icon: Hourglass, label: 'Capture queue', value: stats.data?.queue },
            ]}
          />
          <ThreatMix by={c?.by_confidence ?? {}} total={c?.threats ?? 0} />
        </div>
        <div className="grid content-start gap-6">
          <SweepCard brandId={brand.id} sweep={s.sweep} patrol={s.patrol} />
          <SubmitPanel />
          {brand.fictional ? <DemoPanel /> : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>Live activity</CardTitle>
            <CardDescription>Matches, page captures and verdicts as they happen.</CardDescription>
          </CardHeader>
          <CardContent><Feed /></CardContent>
        </Card>
        <Card className="content-start gap-4">
          <CardHeader>
            <CardTitle>Certificate stream</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Radio className={isLive ? 'size-4 text-emerald-600' : 'size-4 text-muted-foreground'} />
              {live?.logs ?? 0} public logs{isLive ? ' · live' : ' · polling off'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="text-4xl font-bold tabular-nums">
              {(live?.rate_now ?? live?.certs_per_s ?? 0).toFixed(0)}
              <span className="ml-2 text-sm font-medium text-muted-foreground">certificates / second</span>
            </div>
            <ChartContainer config={rateConfig} className="h-16 w-full">
              <AreaChart data={rate.map((v, i) => ({ i, rate: v }))} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                <XAxis dataKey="i" hide />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Area dataKey="rate" type="monotone" stroke="var(--color-rate)" fill="var(--color-rate)" fillOpacity={0.15} isAnimationActive={false} />
              </AreaChart>
            </ChartContainer>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Fact label="Certificates read" value={(live?.certs ?? 0).toLocaleString()} />
              <Fact label="Unique hostnames" value={(live?.unique_domains ?? 0).toLocaleString()} />
              <Fact label={`Matched ${brand.display_name}`} value={(live?.hits ?? 0).toLocaleString()} strong />
              <Fact label="Uptime" value={fmtDuration((live?.uptime_s ?? 0) * 1000)} />
            </dl>
          </CardContent>
        </Card>
      </div>
    </Page>
  )
}

/** The one thing to do next, from the server's setup state. Same logic the setup wizard uses. */
function NextStepCard({ action }: { action: NextAction }) {
  const clear = action.key === 'all_clear'
  const wait = action.key === 'wait_profile'
  return (
    <Card className={cn('border-primary/30', clear ? 'bg-ok/40' : 'bg-accent')}>
      <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', clear ? 'bg-ok text-ok-foreground' : 'bg-primary/10 text-primary')}>
          {clear ? <Check className="size-5" /> : wait ? <Loader2 className="size-5 animate-spin" /> : <ArrowRight className="size-5" />}
        </span>
        <div className="min-w-[14rem] flex-1">
          <div className="text-xs font-medium text-muted-foreground">{clear ? 'Status' : 'Your next step'}</div>
          <div className="text-lg font-semibold">{action.title}</div>
          <p className="text-sm text-muted-foreground">{action.detail}</p>
        </div>
        {!clear ? (
          <Button asChild size="lg">
            <Link to={action.href as never}>{action.key === 'review_notices' ? 'Review notices' : action.key === 'file_notices' ? 'File notices' : action.key === 'start_protection' ? 'Start protection' : action.key === 'wait_profile' ? 'See progress' : action.key === 'prove_ownership' ? 'Prove ownership' : 'Review details'} <ArrowRight /></Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

/** The scan: every place HAUL16 looks (domains, certificate history, Telegram, search, ads), source by source. */
function SweepCard({ brandId, sweep, patrol }: { brandId: string; sweep: SweepStatus; patrol?: { hours: number; next_at: string | null } }) {
  const qc = useQueryClient()
  const run = useMutation({
    mutationFn: () => api.sweep(brandId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['setup', brandId] }),
    onError: (e: Error) => toast.error(e.message),
  })
  const running = sweep.status === 'running'
  // When a scan ends, what it found (alerts, threats, counts) should show up at once, not on the next poll.
  useEffect(() => {
    if (sweep.status === 'done') for (const k of ['alerts', 'stats', 'threats']) qc.invalidateQueries({ queryKey: [k] })
  }, [sweep.status, sweep.updated_at, qc])
  const pct = sweep.generated ? Math.round(((sweep.checked ?? 0) / sweep.generated) * 100) : 0
  const sources = sweep.sources ?? {}
  const skipped = Object.values(sources).filter((s) => s.status === 'skipped').length
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scan</CardTitle>
        <CardDescription>
          Looks for look-alike domains, new certificates, Telegram accounts, fake pages and press warnings.
          {patrol && patrol.hours > 0 && patrol.next_at ? ` Next automatic scan ${new Date(patrol.next_at).toLocaleString()}.` : patrol?.hours === 0 ? ' Automatic scans are off.' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {running && sweep.generated ? <div className="h-2 overflow-hidden rounded-sm bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div> : null}
        {sweep.status === 'done' ? (
          <p className="text-sm">
            Last scan sent <strong>{sweep.queued}</strong> thing{sweep.queued === 1 ? '' : 's'} for analysis{sweep.skipped_known ? `, ${sweep.skipped_known} already tracked` : ''}.
            {sweep.updated_at ? <span className="text-muted-foreground"> {new Date(sweep.updated_at).toLocaleString()}</span> : null}
          </p>
        ) : sweep.status === 'failed' ? (
          <p className="text-sm text-destructive">The last scan failed. {sweep.error}</p>
        ) : sweep.status === 'none' ? (
          <p className="text-sm text-muted-foreground">No scan has run yet.</p>
        ) : null}
        <ScanSources sources={sources} />
        {skipped ? <p className="text-xs text-muted-foreground">{skipped} source{skipped === 1 ? ' was' : 's were'} skipped. Add the key it names on the server, or see <Link to="/settings">Settings</Link>.</p> : null}
        <Button variant="outline" className="justify-self-start" disabled={running || run.isPending} onClick={() => run.mutate()}>
          {running ? 'Scanning…' : sweep.status === 'none' ? 'Scan now' : 'Scan again'}
        </Button>
      </CardContent>
    </Card>
  )
}

type Metric = { icon: React.ComponentType<{ className?: string }>; label: string; value?: number; to?: string; hot?: boolean }

function MetricList({ items }: { items: Metric[] }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      {items.map((m, i) => {
        const body = (
          <div className={cn('flex items-center gap-4 px-5 py-4', i > 0 && 'border-t')}>
            <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground', m.hot && 'bg-signal/10 text-signal')}>
              <m.icon className="size-5" />
            </span>
            <div>
              <div className={cn('text-2xl font-bold tabular-nums leading-none', m.hot && 'text-signal')}>{m.value ?? '—'}</div>
              <div className="mt-1 text-sm text-muted-foreground">{m.label}</div>
            </div>
          </div>
        )
        return m.to ? (
          <Link key={m.label} to={m.to as never} className="block text-foreground transition-colors hover:bg-accent/60">{body}</Link>
        ) : (
          <div key={m.label}>{body}</div>
        )
      })}
    </Card>
  )
}

const MIX = [
  { key: 'high', label: 'High', color: '#e0483a' },
  { key: 'medium', label: 'Medium', color: '#f0a500' },
  { key: 'low', label: 'Low', color: '#b9b4e6' },
  { key: 'unknown', label: 'Unknown', color: '#7c8cd9' },
  { key: 'pending', label: 'Analysing', color: '#cbd5e1' },
] as const

function ThreatMix({ by, total }: { by: Record<string, number>; total: number }) {
  const rows = MIX.map((m) => ({ ...m, n: by[m.key] ?? 0 }))
  const pie = total ? rows.filter((r) => r.n) : [{ key: 'none', label: 'none', color: '#e6e4f2', n: 1 }]
  const cfg = Object.fromEntries(MIX.map((m) => [m.key, { label: m.label, color: m.color }])) satisfies ChartConfig
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Threat mix</CardTitle>
        <CardDescription>Verdicts across every site tracked</CardDescription>
        <CardAction>
          <Link to="/threats" className="text-sm font-semibold underline underline-offset-4">Open threats</Link>
        </CardAction>
      </CardHeader>
      <CardContent className="grid items-center gap-6 sm:grid-cols-[14rem_1fr]">
        <div className="relative mx-auto size-56">
          <ChartContainer config={cfg} className="size-56">
            <PieChart>
              <Pie data={pie} dataKey="n" nameKey="label" innerRadius={74} outerRadius={104} paddingAngle={total ? 2 : 0} stroke="none" isAnimationActive={false}>
                {pie.map((r) => <Cell key={r.key} fill={r.color} />)}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
            <div className="text-4xl font-bold tabular-nums">{total}</div>
            <div className="text-xs text-muted-foreground">sites tracked</div>
          </div>
        </div>
        <div className="grid gap-4">
          {rows.map((r) => (
            <div key={r.key} className="grid gap-1.5">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">{r.label}</span>
                <span className="tabular-nums text-muted-foreground">{r.n}{total ? ` · ${Math.round((r.n / total) * 100)}%` : ''}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-sm bg-muted">
                <div className="h-full rounded-sm" style={{ width: total ? `${(r.n / total) * 100}%` : 0, background: r.color }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function Fact({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={strong ? 'font-semibold text-primary tabular-nums' : 'tabular-nums'}>{value}</dd>
    </div>
  )
}

function Feed() {
  const feed = useFeed()
  // Live events only cover this browser session; fill in with what the store already holds.
  const recent = useQuery({ queryKey: ['threats', 'recent'], queryFn: () => api.threats(), refetchInterval: 15_000 })
  const liveIds = new Set(feed.map((e) => ('threat_id' in e ? e.threat_id : '')))
  const earlier = (recent.data ?? []).filter((t) => !liveIds.has(t.id)).slice(0, 15)
  if (!feed.length && !earlier.length)
    return (
      <Empty>
        Nothing yet. Look-alikes show up here as soon as the scan or the certificate logs find them.
      </Empty>
    )
  return (
    <ScrollArea className="h-80 pr-3">
      <ol className="grid gap-1 text-sm">
        {feed.map((e) => (
          <FeedRow key={e.key} e={e} />
        ))}
        {earlier.length ? <li className="pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Earlier</li> : null}
        {earlier.map((t) => (
          <Row key={t.id} time={new Date(t.detected_at).toLocaleTimeString()} tag="verdict" tagVariant="secondary">
            <Link to="/threats/$threatId" params={{ threatId: t.id }} className="font-mono">{t.hostname}</Link>
            <ConfidenceChip value={t.status === 'queued' ? 'pending' : t.confidence} />
            {t.score != null ? <span className="text-xs text-muted-foreground">score {t.score}</span> : null}
            {t.case_id ? (
              <Link to="/cases/$caseId" params={{ caseId: t.case_id }} className="inline-flex items-center gap-1 text-xs">
                case {t.case_id} <ArrowRight className="size-3" />
              </Link>
            ) : null}
          </Row>
        ))}
      </ol>
    </ScrollArea>
  )
}

function Row({ time, tag, tagVariant, children }: { time: string; tag: string; tagVariant: 'secondary' | 'outline' | 'default' | 'ok' | 'warn'; children: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-1.5 hover:bg-muted/60">
      <span className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">{time}</span>
      <Badge variant={tagVariant} className="w-20 shrink-0">{tag}</Badge>
      {children}
    </li>
  )
}

function FeedRow({ e }: { e: FeedItem }) {
  const t = new Date(e.at).toLocaleTimeString()
  switch (e.type) {
    case 'hit':
      return (
        <Row time={t} tag="match" tagVariant="warn">
          <span className="font-mono">{e.host}</span>
          {e.reasons.map((r) => <Reason key={r} code={r} />)}
          <span className="text-xs text-muted-foreground">{e.source === 'certificate_transparency' ? e.ct_log : e.source}</span>
        </Row>
      )
    case 'capturing':
      return (
        <Row time={t} tag="capturing" tagVariant="outline">
          <span className="font-mono">{e.host}</span>
          <span className="text-xs text-muted-foreground">sandboxed browser: screenshot, hashes, identifiers</span>
        </Row>
      )
    case 'scored':
      return (
        <Row time={t} tag="verdict" tagVariant="secondary">
          <Link to="/threats/$threatId" params={{ threatId: e.threat_id }} className="font-mono">{e.host}</Link>
          <ConfidenceChip value={e.confidence} />
          <span className="text-xs text-muted-foreground">score {e.score}</span>
          {e.case_id ? (
            <Link to="/cases/$caseId" params={{ caseId: e.case_id }} className="inline-flex items-center gap-1 text-xs">
              {e.linked_via?.length ? `joined case via ${e.linked_via.join(', ')}` : 'opened case'}
              {e.notices_drafted ? ` · ${e.notices_drafted} notices drafted` : ''} <ArrowRight className="size-3" />
            </Link>
          ) : null}
          {e.retry_in_s ? <span className="text-xs text-muted-foreground">not reachable yet, retry in {e.retry_in_s}s</span> : null}
        </Row>
      )
    case 'filed':
      return (
        <Row time={t} tag="filed" tagVariant="ok">
          <span>{e.channel}</span>
          <span className="text-xs text-muted-foreground">dry run, takedown clock started</span>
        </Row>
      )
    default:
      return null
  }
}

function DemoPanel() {
  const qc = useQueryClient()
  const run = useMutation({
    mutationFn: api.demoClone,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stats'] }),
  })
  const reset = useMutation({
    mutationFn: api.demoReset,
    onSuccess: () => {
      qc.setQueryData(['live', 'feed'], [])
      qc.invalidateQueries()
    },
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Run a demo clone</CardTitle>
        <CardDescription>
          Pushes a fictional site through the real capture, scoring, case and notice pipeline. Served locally, labelled as a fixture.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Button variant="outline" className="h-auto justify-between" onClick={() => run.mutate('clone')} disabled={run.isPending}>
          Clone A <span className="font-mono text-xs text-muted-foreground">nkwaex-support.com</span>
        </Button>
        <Button variant="outline" className="h-auto justify-between" onClick={() => run.mutate('clone2')} disabled={run.isPending}>
          Clone B, same operator <span className="font-mono text-xs text-muted-foreground">nkwaex-airdrop.top</span>
        </Button>
        <Button variant="ghost" className="h-auto justify-between" onClick={() => run.mutate('decoy')} disabled={run.isPending}>
          Decoy business <span className="font-mono text-xs text-muted-foreground">nkwafarms.com</span>
        </Button>
        {run.data?.duplicate ? <p className="text-xs text-muted-foreground">Already tracked. Reset the demo to run it again.</p> : null}
        <ErrorNote error={run.error} />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="link" size="sm" className="justify-self-start px-0 text-muted-foreground">Reset demo data</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset demo data?</AlertDialogTitle>
              <AlertDialogDescription>Deletes all threats, cases, notices and the audit log. This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => reset.mutate()}>Delete everything</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}

function SubmitPanel() {
  const qc = useQueryClient()
  const [url, setUrl] = useState('')
  const submit = useMutation({
    mutationFn: () => api.inject(url.trim()),
    onSuccess: () => {
      setUrl('')
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Report a suspicious link</CardTitle>
        <CardDescription>A link a customer forwarded. It is captured in the sandbox and scored against the register.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (url.trim()) submit.mutate()
          }}
        >
          <Label htmlFor="inject-url" className="sr-only">Suspicious URL</Label>
          <Input id="inject-url" type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} required />
          <Button type="submit" disabled={submit.isPending}>{submit.isPending ? 'Queuing…' : 'Check'}</Button>
        </form>
        {submit.data ? <p className="text-xs text-muted-foreground">{submit.data.duplicate ? 'Already tracked.' : 'Queued for capture.'}</p> : null}
        <ErrorNote error={submit.error} />
      </CardContent>
    </Card>
  )
}
