import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { api, type CaseDetail, type ClockEvent, type LivenessItem } from '@/api'
import {
  Ago, CHANNEL_LABEL, ConfidenceChip, Empty, ErrorNote, Mono, Stat, fmtDuration, fmtTime, useNow,
} from '@/ui'
import { Page } from '@/components/page'
import { PageHeader } from '@/components/page-header'
import { NoticeCard } from '@/components/notice-card'
import { ThreatEvidence } from '@/components/threat-evidence'
import { WorkflowStepper, caseReached } from '@/components/workflow-stepper'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

const TABS = ['overview', 'evidence', 'notices', 'clock', 'audit'] as const
type Tab = (typeof TABS)[number]

export const Route = createFileRoute('/cases/$caseId')({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => ({
    tab: (TABS as readonly unknown[]).includes(s.tab) ? (s.tab as Tab) : undefined,
  }),
  component: CasePage,
})

function CasePage() {
  const { caseId } = Route.useParams()
  const { tab = 'overview' } = Route.useSearch()
  const navigate = Route.useNavigate()
  const q = useQuery({ queryKey: ['case', caseId], queryFn: () => api.case(caseId), refetchInterval: 10_000 })
  const c = q.data

  const crumbs = [{ label: 'Cases', to: '/cases' }, { label: c?.title ?? caseId }]
  if (q.error) return <Page crumbs={crumbs}><ErrorNote error={q.error} /></Page>
  if (!c) return <Page crumbs={crumbs}><Skeleton className="h-64 w-full" /></Page>

  const awaiting = c.notices.filter((n) => n.status === 'drafted').length
  const ready = c.notices.filter((n) => n.status === 'approved').length
  const filed = c.notices.filter((n) => n.status === 'filed_dry_run' || n.status === 'filed').length
  const removed = c.clock.filter((e) => e.event === 'removed').length

  return (
    <Page crumbs={crumbs}>
      <PageHeader
        title={c.title}
        description={
          <>
            <span className="font-mono text-xs">{c.id}</span> · opened {fmtTime(c.opened_at)} · first detection{' '}
            <Ago iso={c.first_detected ?? c.opened_at} />
          </>
        }
        actions={
          awaiting ? (
            <Button onClick={() => navigate({ search: { tab: 'notices' } })}>Review {awaiting} notices <ArrowRight /></Button>
          ) : ready ? (
            <Button onClick={() => navigate({ search: { tab: 'notices' } })}>File {ready} approved <ArrowRight /></Button>
          ) : null
        }
      />
      <WorkflowStepper reached={caseReached(c)} />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Linked threats" value={c.threats.length} />
        <Stat label="Awaiting approval" value={awaiting} tone={awaiting ? 'warn' : undefined} />
        <Stat label="Filed" value={filed} />
        <Stat label="Removals logged" value={removed} tone={removed ? 'good' : undefined} />
      </section>

      <Tabs value={tab} onValueChange={(v) => navigate({ search: { tab: v as Tab }, replace: true })}>
        <div className="max-w-full overflow-x-auto">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="evidence">Evidence ({c.threats.length})</TabsTrigger>
          <TabsTrigger value="notices">
            Notices ({c.notices.length}){awaiting ? <Badge variant="warn" className="ml-1.5">{awaiting}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="clock">Clock</TabsTrigger>
          <TabsTrigger value="audit">Audit ({c.audit.length})</TabsTrigger>
        </TabsList>
        </div>
        <TabsContent value="overview" className="mt-4"><Campaign c={c} /></TabsContent>
        <TabsContent value="evidence" className="mt-4 grid gap-4">
          <p className="text-sm text-muted-foreground">Captured by HAUL16. Notices may only state what is shown here.</p>
          {c.threats.map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  <Link to="/threats/$threatId" params={{ threatId: t.id }} className="font-mono">{t.hostname}</Link>
                </CardTitle>
                <CardDescription>detected {fmtTime(t.detected_at)}</CardDescription>
              </CardHeader>
              <CardContent><ThreatEvidence t={t} /></CardContent>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="notices" className="mt-4"><Notices c={c} /></TabsContent>
        <TabsContent value="clock" className="mt-4"><Clock c={c} /></TabsContent>
        <TabsContent value="audit" className="mt-4"><Audit c={c} /></TabsContent>
      </Tabs>
    </Page>
  )
}

function Campaign({ c }: { c: CaseDetail }) {
  const shared = c.identifiers.filter((i) => i.n > 1)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign</CardTitle>
        <CardDescription>
          Threats are linked only on a shared payment number, wallet or Telegram handle. A shared host, registrar or copied logo is not enough.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {c.threats.length > 1 ? (
          <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
            <div className="grid gap-2">
              {c.threats.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-md border p-2">
                  <ConfidenceChip value={t.confidence} /> <Mono>{t.hostname}</Mono>
                </div>
              ))}
            </div>
            <ArrowRight className="mx-auto hidden text-muted-foreground sm:block" aria-hidden="true" />
            <div className="grid gap-2">
              {shared.map((i) => (
                <div key={`${i.kind}:${i.value}`} className="rounded-md border border-primary/30 bg-accent p-2">
                  <Badge variant="outline">{i.kind}</Badge> <Mono>{i.value}</Mono>
                  <div className="text-xs text-muted-foreground">shared by {i.n} sites</div>
                </div>
              ))}
              {!shared.length ? <div className="text-sm text-muted-foreground">No shared identifier.</div> : null}
            </div>
          </div>
        ) : null}
        {c.identifiers.length ? (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Identifier</TableHead><TableHead>Kind</TableHead><TableHead>Seen on</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {c.identifiers.map((i) => (
                <TableRow key={`${i.kind}:${i.value}`}>
                  <TableCell className="font-mono text-sm">{i.value}</TableCell>
                  <TableCell>{i.kind}</TableCell>
                  <TableCell className="font-mono text-xs">{i.hosts}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty>No payment identifiers captured.</Empty>
        )}
      </CardContent>
    </Card>
  )
}

function Notices({ c }: { c: CaseDetail }) {
  const qc = useQueryClient()
  const redraft = useMutation({
    mutationFn: () => api.redraft(c.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['case', c.id] })
      qc.invalidateQueries({ queryKey: ['notices'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Drafted from templates using captured evidence only. A named person (set “Acting as” in the top-right account menu) must approve each one. Filing is a dry run: nothing is sent.
      </p>
      {!c.notices.length ? (
        <Empty>
          No notices yet.{' '}
          <Button size="sm" onClick={() => redraft.mutate()} disabled={redraft.isPending}>Draft notices</Button>
        </Empty>
      ) : (
        c.notices.map((n) => <NoticeCard key={n.id} n={n} host={c.threats.find((t) => t.id === n.threat_id)?.hostname} />)
      )}
      <ErrorNote error={redraft.error} />
    </div>
  )
}

const LIVE_BADGE: Record<LivenessItem['status'], 'high' | 'ok' | 'secondary'> = { live: 'high', gone: 'ok', unknown: 'secondary' }
const LIVE_TEXT: Record<LivenessItem['status'], string> = { live: 'still up', gone: 'taken down', unknown: 'unclear' }

/** Is each reported site still up? Re-checked every 30 minutes for filed notices, or on demand. */
function SiteStatus({ caseId, hasFiled }: { caseId: string; hasFiled: boolean }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['liveness', caseId], queryFn: () => api.liveness(caseId), enabled: hasFiled, refetchInterval: 60_000 })
  const run = useMutation({
    mutationFn: () => api.livenessRun(caseId),
    onSuccess: (r) => {
      qc.setQueryData(['liveness', caseId], r)
      qc.invalidateQueries({ queryKey: ['case', caseId] })
      qc.invalidateQueries({ queryKey: ['alerts'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  if (!hasFiled) return null
  return (
    <div className="grid gap-2 rounded-md border bg-muted/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">Are the reported sites still up?</div>
        <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate()}>{run.isPending ? 'Checking…' : 'Check now'}</Button>
      </div>
      {q.data?.length ? (
        <ul className="grid gap-1 text-sm">
          {q.data.map((s) => (
            <li key={s.threat_id} className="flex flex-wrap items-center gap-2">
              <Mono>{s.hostname}</Mono>
              <Badge variant={LIVE_BADGE[s.status]}>{LIVE_TEXT[s.status]}</Badge>
              <span className="text-xs text-muted-foreground">{s.reason} · checked {fmtTime(s.checked_at)}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-muted-foreground">Not checked yet. HAUL16 checks every 30 minutes. For notices you really filed, a site that goes down is recorded as removed automatically.</p>}
    </div>
  )
}

function Clock({ c }: { c: CaseDetail }) {
  const now = useNow(1000)
  const detected = new Date(c.first_detected ?? c.opened_at).getTime()
  const byNotice = new Map<string, ClockEvent[]>()
  for (const e of c.clock) {
    if (!e.notice_id) continue
    byNotice.set(e.notice_id, [...(byNotice.get(e.notice_id) ?? []), e])
  }
  const filed = c.notices.filter((n) => byNotice.has(n.id))
  return (
    <Card>
      <CardHeader>
        <CardTitle>Takedown clock</CardTitle>
        <CardDescription>Per channel: detected → filed → first response → removed. Times after filing are simulated and labelled.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <SiteStatus caseId={c.id} hasFiled={filed.length > 0} />
        {!filed.length ? (
          <Empty>The clock starts when the first approved notice is filed.</Empty>
        ) : (
          filed.map((n) => {
            const evs = byNotice.get(n.id)!
            const at = (k: string) => evs.find((e) => e.event === k)
            const f = at('filed'), r = at('first_response'), x = at('removed')
            const end = x ? new Date(x.ts).getTime() : now
            const steps: [string, { ts: string } | undefined][] = [
              ['Detected', { ts: new Date(detected).toISOString() }],
              ['Filed', f],
              ['First response', r],
              ['Removed', x],
            ]
            return (
              <div key={n.id} className="grid gap-3 rounded-md border p-4 md:grid-cols-[10rem_1fr_auto] md:items-center">
                <div className="font-medium">{CHANNEL_LABEL[n.channel] ?? n.channel}</div>
                <ol className="grid grid-cols-4 gap-2">
                  {steps.map(([label, e]) => (
                    <li key={label} className={cn('grid gap-0.5 border-t-2 pt-1.5 text-xs', e ? 'border-emerald-600' : 'border-border text-muted-foreground')}>
                      <span className="font-medium">{label}</span>
                      <span>{e ? fmtTime(e.ts) : '—'}</span>
                    </li>
                  ))}
                </ol>
                <div className="text-right">
                  <div className={cn('text-lg font-semibold tabular-nums', x ? 'text-emerald-700' : 'text-signal')}>{fmtDuration(end - detected)}</div>
                  <div className="text-xs text-muted-foreground">{x ? 'detected → removed' : 'and counting'}</div>
                  {f ? (f.simulated ? <Badge variant="warn">dry run</Badge> : <Badge variant="ok">real</Badge>) : null}
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

function Audit({ c }: { c: CaseDetail }) {
  return (
    <Card className="py-0">
      <Table>
        <TableHeader>
          <TableRow><TableHead>Time</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead>Ref</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {c.audit.map((a, i) => (
            <TableRow key={i}>
              <TableCell className="whitespace-nowrap text-xs">{fmtTime(a.ts)}</TableCell>
              <TableCell>{a.actor}</TableCell>
              <TableCell>{a.action.replaceAll('_', ' ')}</TableCell>
              <TableCell className="font-mono text-xs">{a.ref}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
