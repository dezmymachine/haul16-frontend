import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight, Download, Globe, Layers, MessageSquare, Phone, Share2, ShieldCheck, Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, type CaseDetail, type ClockEvent } from '@/api'
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

const TABS = ['overview', 'evidence', 'notices', 'clock', 'audit', 'dossier'] as const
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
  const [downloading, setDownloading] = useState(false)
  const q = useQuery({ queryKey: ['case', caseId], queryFn: () => api.case(caseId), refetchInterval: 10_000 })
  const c = q.data

  const crumbs = [{ label: 'Cases', to: '/cases' }, { label: c?.title ?? caseId }]
  if (q.error) return <Page crumbs={crumbs}><ErrorNote error={q.error} /></Page>
  if (!c) return <Page crumbs={crumbs}><Skeleton className="h-64 w-full" /></Page>

  const awaiting = c.notices.filter((n) => n.status === 'drafted').length
  const ready = c.notices.filter((n) => n.status === 'approved').length
  const filed = c.notices.filter((n) => n.status === 'filed_dry_run').length
  const removed = c.clock.filter((e) => e.event === 'removed').length

  const downloadDossier = async () => {
    try {
      setDownloading(true)
      const dossier = await api.dossier(caseId)
      const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `haul16-dossier-${caseId}.json`
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success('Regulatory Evidence Dossier exported')
    } catch {
      toast.error('Failed to export dossier')
    } finally {
      setDownloading(false)
    }
  }

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
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadDossier} disabled={downloading}>
              <Download className="mr-1.5 size-4" /> Export Dossier
            </Button>
            {awaiting ? (
              <Button onClick={() => navigate({ search: { tab: 'notices' } })}>Review {awaiting} notices <ArrowRight /></Button>
            ) : ready ? (
              <Button onClick={() => navigate({ search: { tab: 'notices' } })}>File {ready} approved <ArrowRight /></Button>
            ) : null}
          </div>
        }
      />
      <WorkflowStepper reached={caseReached(c)} />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Linked threats" value={c.threats.length} />
        <Stat label="Awaiting approval" value={awaiting} tone={awaiting ? 'warn' : undefined} />
        <Stat label="Filed (dry run)" value={filed} />
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
          <TabsTrigger value="dossier">Dossier</TabsTrigger>
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
        <TabsContent value="dossier" className="mt-4"><Dossier caseId={c.id} /></TabsContent>
      </Tabs>
    </Page>
  )
}

function Campaign({ c }: { c: CaseDetail }) {
  const [activeNode, setActiveNode] = useState<string | null>(null)
  const shared = c.identifiers.filter((i) => i.n > 1)

  // Map each threat to its identifiers and vice-versa
  const threatNodes = c.threats
  const identNodes = c.identifiers

  // Height and vertical spacing for the SVG cluster graph
  const rowHeight = 76
  const totalRows = Math.max(threatNodes.length, identNodes.length, 1)
  const svgHeight = Math.max(220, totalRows * rowHeight + 40)
  const svgWidth = 840

  const getThreatY = (index: number) => {
    if (threatNodes.length === 1) return svgHeight / 2
    return 40 + (index * (svgHeight - 80)) / (threatNodes.length - 1)
  }

  const getIdentY = (index: number) => {
    if (identNodes.length === 1) return svgHeight / 2
    return 40 + (index * (svgHeight - 80)) / (identNodes.length - 1)
  }

  const kindIcon = (kind: string) => {
    if (kind === 'phone') return <Phone className="size-3.5 text-amber-500" />
    if (kind === 'wallet') return <Wallet className="size-3.5 text-purple-500" />
    if (kind === 'telegram' || kind === 'whatsapp') return <MessageSquare className="size-3.5 text-sky-500" />
    return <Layers className="size-3.5 text-muted-foreground" />
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Share2 className="size-5 text-primary" />
              <CardTitle className="text-base font-semibold">Campaign Infrastructure Topology</CardTitle>
            </div>
            <CardDescription>
              Threats cluster strictly on common payment numbers, wallets, or direct contact handles. Shared hosting or registrars never link campaigns.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={shared.length ? 'default' : 'secondary'} className="text-xs">
              {shared.length ? `${shared.length} Shared Infrastructure Point(s)` : 'Single Domain Incident'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-lg border bg-muted/30 p-3 text-xs">
            <div>
              <span className="text-muted-foreground block">Linked Domains:</span>
              <span className="font-semibold text-sm">{c.threats.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Extracted Payment Nodes:</span>
              <span className="font-semibold text-sm">{c.identifiers.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Shared Collection Points:</span>
              <span className="font-semibold text-sm">{shared.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Clustering Standard:</span>
              <span className="font-semibold text-sm text-emerald-600">Ghana Act 772 / Act 843</span>
            </div>
          </div>

          {/* Interactive Cluster Graph */}
          {identNodes.length > 0 ? (
            <div className="relative overflow-x-auto rounded-lg border bg-background/50 p-2">
              <div className="flex justify-between px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
                <span>Suspect Hostnames ({threatNodes.length})</span>
                <span>Connecting Infrastructure ({identNodes.length})</span>
              </div>
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full min-w-[700px] h-auto select-none"
                style={{ maxHeight: `${svgHeight}px` }}
              >
                <defs>
                  <linearGradient id="link-grad-active" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="1" />
                  </linearGradient>
                  <linearGradient id="link-grad-shared" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#d97706" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#d97706" stopOpacity="0.9" />
                  </linearGradient>
                </defs>

                {/* Connecting Edges */}
                {identNodes.flatMap((ident, j) => {
                  const y2 = getIdentY(j)
                  const hosts = ident.hosts.split(' | ')
                  const identKey = `${ident.kind}:${ident.value}`

                  return hosts.map((h) => {
                    const i = threatNodes.findIndex((t) => t.hostname === h)
                    if (i === -1) return null
                    const y1 = getThreatY(i)
                    const isConnected = activeNode === h || activeNode === identKey
                    const isDimmed = activeNode !== null && !isConnected
                    const isShared = ident.n > 1

                    return (
                      <path
                        key={`${h}-${identKey}`}
                        d={`M 260 ${y1} C 390 ${y1}, 450 ${y2}, 560 ${y2}`}
                        fill="none"
                        stroke={
                          isConnected
                            ? 'url(#link-grad-active)'
                            : isShared
                            ? 'url(#link-grad-shared)'
                            : 'currentColor'
                        }
                        strokeWidth={isConnected ? 3 : isShared ? 2 : 1}
                        strokeDasharray={isConnected ? 'none' : isShared ? 'none' : '4 4'}
                        opacity={isDimmed ? 0.15 : isConnected ? 1 : isShared ? 0.75 : 0.3}
                        className="transition-all duration-200"
                      />
                    )
                  })
                })}

                {/* Threat Nodes (Left) */}
                {threatNodes.map((t, i) => {
                  const y = getThreatY(i)
                  const isNodeActive = activeNode === t.hostname
                  const isConnectedToActive =
                    activeNode !== null &&
                    identNodes.some((ident) => `${ident.kind}:${ident.value}` === activeNode && ident.hosts.includes(t.hostname))
                  const isDimmed = activeNode !== null && !isNodeActive && !isConnectedToActive

                  return (
                    <g
                      key={t.id}
                      transform={`translate(15, ${y - 24})`}
                      className="cursor-pointer"
                      onMouseEnter={() => setActiveNode(t.hostname)}
                      onMouseLeave={() => setActiveNode(null)}
                    >
                      <rect
                        width="245"
                        height="48"
                        rx="8"
                        className={`transition-colors ${
                          isNodeActive || isConnectedToActive
                            ? 'fill-accent stroke-primary stroke-2 shadow-sm'
                            : 'fill-card stroke-border hover:fill-accent/60'
                        }`}
                        opacity={isDimmed ? 0.4 : 1}
                      />
                      <foreignObject x="10" y="6" width="225" height="36">
                        <div className="flex items-center justify-between text-xs h-full">
                          <div className="flex items-center gap-2 overflow-hidden mr-2">
                            <Globe className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="font-mono truncate font-medium">{t.hostname}</span>
                          </div>
                          <ConfidenceChip value={t.confidence} />
                        </div>
                      </foreignObject>
                    </g>
                  )
                })}

                {/* Identifier Nodes (Right) */}
                {identNodes.map((ident, j) => {
                  const y = getIdentY(j)
                  const identKey = `${ident.kind}:${ident.value}`
                  const isNodeActive = activeNode === identKey
                  const isConnectedToActive =
                    activeNode !== null &&
                    ident.hosts.split(' | ').includes(activeNode)
                  const isDimmed = activeNode !== null && !isNodeActive && !isConnectedToActive
                  const isShared = ident.n > 1

                  return (
                    <g
                      key={identKey}
                      transform={`translate(560, ${y - 24})`}
                      className="cursor-pointer"
                      onMouseEnter={() => setActiveNode(identKey)}
                      onMouseLeave={() => setActiveNode(null)}
                    >
                      <rect
                        width="265"
                        height="48"
                        rx="8"
                        className={`transition-colors ${
                          isNodeActive || isConnectedToActive
                            ? 'fill-accent stroke-primary stroke-2 shadow-sm'
                            : isShared
                            ? 'fill-card stroke-amber-500/70 hover:fill-accent/60'
                            : 'fill-card stroke-border hover:fill-accent/60'
                        }`}
                        opacity={isDimmed ? 0.4 : 1}
                      />
                      <foreignObject x="10" y="6" width="245" height="36">
                        <div className="flex items-center justify-between text-xs h-full">
                          <div className="flex items-center gap-2 overflow-hidden mr-2">
                            {kindIcon(ident.kind)}
                            <div className="truncate">
                              <span className="font-mono font-medium block truncate">{ident.value}</span>
                              <span className="text-[10px] text-muted-foreground capitalize">{ident.kind}</span>
                            </div>
                          </div>
                          {isShared ? (
                            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30 shrink-0">
                              Linked ({ident.n})
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground shrink-0">1 site</span>
                          )}
                        </div>
                      </foreignObject>
                    </g>
                  )
                })}
              </svg>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No financial payment identifiers or contact channels captured on page. Case is tracking domain only.
            </div>
          )}

          {/* Comprehensive Identifiers Table */}
          {c.identifiers.length ? (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Captured Infrastructure Registry
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Attributed Domains</TableHead>
                    <TableHead className="text-right">Link Strength</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {c.identifiers.map((i) => (
                    <TableRow key={`${i.kind}:${i.value}`} className={i.n > 1 ? 'bg-accent/30 font-medium' : undefined}>
                      <TableCell className="capitalize flex items-center gap-1.5 py-3">
                        {kindIcon(i.kind)}
                        <span>{i.kind === 'phone' ? 'MoMo Phone' : i.kind}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{i.value}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{i.hosts}</TableCell>
                      <TableCell className="text-right">
                        {i.n > 1 ? (
                          <Badge variant="default" className="text-xs">
                            Campaign Link ({i.n} sites)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Isolated
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
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
                  {f?.simulated ? <Badge variant="warn">dry run</Badge> : null}
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

function Dossier({ caseId }: { caseId: string }) {
  const q = useQuery({ queryKey: ['case-dossier', caseId], queryFn: () => api.dossier(caseId) })
  const d = q.data

  if (q.error) return <ErrorNote error={q.error} />
  if (!d) return <Skeleton className="h-64 w-full" />

  const download = () => {
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${d.dossier_id}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success('Dossier exported to JSON')
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-emerald-600" />
              <CardTitle className="text-base font-semibold">Regulatory Evidence Dossier</CardTitle>
            </div>
            <CardDescription>
              Cryptographically hashed evidence manifest admissible under Ghana Electronic Transactions Act (Act 772, s. 92).
            </CardDescription>
          </div>
          <Button size="sm" onClick={download}>
            <Download className="mr-1.5 size-4" /> Download JSON
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-md border bg-muted/40 p-3 text-xs font-mono space-y-1">
            <div className="flex flex-wrap justify-between gap-1">
              <span className="text-muted-foreground">DOSSIER ID:</span>
              <span className="font-semibold text-foreground">{d.dossier_id}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-1">
              <span className="text-muted-foreground">MANIFEST SHA-256:</span>
              <span className="font-semibold text-foreground">{d.manifest_sha256}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-1">
              <span className="text-muted-foreground">RULES ENGINE:</span>
              <span>{d.rules_version}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-1">
              <span className="text-muted-foreground">TIMESTAMP:</span>
              <span>{d.generated_at} UTC</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border p-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase">Designated Agent Authority</div>
              <div className="mt-1 font-medium">{d.legal_basis.designated_agent.entity}</div>
              <div className="text-xs text-muted-foreground">Representing: {d.legal_basis.designated_agent.brand_name}</div>
              <div className="mt-2 text-xs font-mono break-all text-muted-foreground">
                Auth Letter SHA-256: <Mono>{d.legal_basis.designated_agent.authorisation_letter_sha256}</Mono>
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase">Statutory Framework (Ghana)</div>
              <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground space-y-1">
                {d.legal_basis.statutes.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Evidence Assets Verified in Dossier</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hostname</TableHead>
                  <TableHead>Verdict</TableHead>
                  <TableHead>HTML SHA-256</TableHead>
                  <TableHead>Screenshot SHA-256</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.threats.map((t) => (
                  <TableRow key={t.threat_id}>
                    <TableCell className="font-mono text-sm">{t.hostname}</TableCell>
                    <TableCell><ConfidenceChip value={t.confidence} /></TableCell>
                    <TableCell className="font-mono text-xs">{t.hashes.html_sha256 ? `${t.hashes.html_sha256.slice(0, 16)}…` : 'none'}</TableCell>
                    <TableCell className="font-mono text-xs">{t.hashes.screenshot_sha256 ? `${t.hashes.screenshot_sha256.slice(0, 16)}…` : 'none'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
