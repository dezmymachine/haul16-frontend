import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Plus, RefreshCw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { api, type ProfileFact } from '@/api'
import { useBrands } from '@/brand'
import { Empty, ErrorNote, Hash, Mono, Stat } from '@/ui'
import { Page } from '@/components/page'
import { PageHeader } from '@/components/page-header'
import { FactRow, VerificationBadge } from '@/components/fact-row'
import { ProfileSteps } from '@/components/profile-steps'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const TABS = ['overview', 'identity', 'domains', 'presence', 'people', 'contact', 'logos', 'press', 'sources'] as const
type Tab = (typeof TABS)[number]

export const Route = createFileRoute('/brand')({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => ({ tab: (TABS as readonly unknown[]).includes(s.tab) ? (s.tab as Tab) : undefined }),
  component: BrandPage,
})

const GROUPS: Record<string, { kinds: string[]; empty: string }> = {
  identity: { kinds: ['legal_name', 'trading_name', 'registration_no', 'licence', 'regulator', 'incorporated', 'hq_address'], empty: 'No legal identity found yet. Add an OpenAI key so the profiler can read the About and Legal pages, or add these by hand later.' },
  domains: { kinds: ['domain', 'dns', 'domain_registration'], empty: 'No domain records yet.' },
  presence: { kinds: ['social', 'telegram', 'linkedin_profile', 'social_profile', 'app'], empty: 'No social accounts, channels or apps found. Add official links when you create the brand, or connect Apify for LinkedIn and social data.' },
  contact: { kinds: ['phone', 'email', 'wallet', 'bank_account', 'payment_instruction'], empty: 'No official phone numbers, emails or payment details found.' },
  press: { kinds: ['warning', 'news'], empty: 'No press found. Add a search API key to look for news and scam warnings that name the brand.' },
  sources: { kinds: ['source'], empty: 'No pages were read yet.' },
}

function Section({ title, facts, brandId, empty, canReview = true }: { title?: string; facts: ProfileFact[]; brandId: string; empty: string; canReview?: boolean }) {
  return (
    <Card className="gap-0 py-0">
      {title ? <CardHeader className="border-b py-4"><CardTitle className="text-base">{title}</CardTitle></CardHeader> : null}
      {facts.length ? <ul>{facts.map((f) => <FactRow key={f.id} f={f} brandId={brandId} canReview={canReview} />)}</ul> : <div className="p-4"><Empty>{empty}</Empty></div>}
    </Card>
  )
}

function BrandPage() {
  const qc = useQueryClient()
  const { tab = 'overview' } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { current, isPending: loadingBrands } = useBrands()
  const id = current?.id
  const q = useQuery({
    queryKey: ['profile', id],
    queryFn: () => api.profile(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const d = query.state.data
      return d && (['profiling', 'draft'].includes(d.brand.status) || ['queued', 'running'].includes(d.job?.status ?? '')) ? 2000 : false
    },
  })
  const rerun = useMutation({
    mutationFn: () => api.profileRun(id!),
    onSuccess: () => {
      toast.success('Rebuilding the profile')
      qc.invalidateQueries({ queryKey: ['profile', id] })
      qc.invalidateQueries({ queryKey: ['brands'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const activate = useMutation({
    mutationFn: () => api.brandActivate(id!),
    onSuccess: () => {
      toast.success('Detection now watches for this brand')
      qc.invalidateQueries()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (loadingBrands) return <Page crumbs={[{ label: 'Insights' }, { label: 'Brand' }]}><Skeleton className="h-64 w-full" /></Page>
  if (!current)
    return (
      <Page crumbs={[{ label: 'Insights' }, { label: 'Brand' }]}>
        <PageHeader title="Brand" description="HAUL16 protects one brand at a time. Add the first one to start." />
        <Empty>No brand yet. <Button asChild size="sm"><Link to="/brands/new"><Plus /> Add a brand</Link></Button></Empty>
      </Page>
    )

  const p = q.data
  const b = p?.brand ?? current
  const facts = (kinds: string[]) => kinds.flatMap((k) => p?.groups[k] ?? [])
  const counts = p?.summary?.counts ?? {}
  const total = Object.values(p?.groups ?? {}).reduce((n, g) => n + g.length, 0)
  const building = b.status !== 'ready'
  const summaryFact = p?.groups.summary?.[0]

  return (
    <Page crumbs={[{ label: 'Insights' }, { label: 'Brand' }]}>
      <PageHeader
        title={b.display_name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {b.website ? <a href={b.website.startsWith('http') ? b.website : `https://${b.website}`} target="_blank" rel="noreferrer">{b.website}</a> : null}
            <Badge variant={b.ownership_status === 'verified' ? 'ok' : 'warn'}>{b.ownership_status === 'verified' ? 'ownership verified' : 'ownership not verified'}</Badge>
            {b.is_active ? <Badge variant="unknown"><Eye /> detection is watching</Badge> : null}
            {b.fictional ? <Badge variant="secondary">fictional demo brand</Badge> : null}
            {b.active_version ? <Badge variant="outline">profile v{b.active_version}</Badge> : null}
          </span>
        }
        actions={
          <>
            <Button variant="outline" asChild><Link to="/brands/$brandId" params={{ brandId: b.id }}><ShieldCheck /> Verify and letter</Link></Button>
            <Button variant="outline" disabled={rerun.isPending || building} onClick={() => rerun.mutate()}><RefreshCw /> Rebuild profile</Button>
            {!b.is_active ? <Button disabled={activate.isPending || building} onClick={() => activate.mutate()}>Watch for this brand</Button> : null}
          </>
        }
      />
      <ErrorNote error={q.error} />
      {q.isPending && id ? <Skeleton className="h-64 w-full" /> : null}
      {building && p?.job ? (
        <Card>
          <CardHeader><CardTitle>Building the profile</CardTitle><CardDescription>This page updates by itself.</CardDescription></CardHeader>
          <CardContent><ProfileSteps steps={p.job.steps} /></CardContent>
        </Card>
      ) : null}

      {p ? (
        <Tabs value={tab} onValueChange={(v) => navigate({ search: { tab: v as Tab }, replace: true })}>
          <div className="max-w-full overflow-x-auto">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="identity">Identity</TabsTrigger>
              <TabsTrigger value="domains">Domains</TabsTrigger>
              <TabsTrigger value="presence">Online presence</TabsTrigger>
              <TabsTrigger value="people">Leadership ({p.people.length})</TabsTrigger>
              <TabsTrigger value="contact">
                Contact and payment{p.needs_review.length ? <Badge variant="warn" className="ml-1.5">{p.needs_review.length}</Badge> : null}
              </TabsTrigger>
              <TabsTrigger value="logos">Logos ({p.assets.length})</TabsTrigger>
              <TabsTrigger value="press">Press ({(p.groups.news?.length ?? 0) + (p.groups.warning?.length ?? 0)})</TabsTrigger>
              <TabsTrigger value="sources">Sources</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-4 grid gap-6">
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label="Facts collected" value={total} />
              <Stat label="Awaiting your decision" value={p.needs_review.length} tone={p.needs_review.length ? 'warn' : undefined} sub="Numbers, wallets and handles are used only after you confirm them" />
              <Stat label="Conflicts" value={p.conflicts.length} tone={p.conflicts.length ? 'warn' : undefined} />
              <Stat label="Pages read" value={counts.source ?? p.groups.source?.length ?? 0} />
            </section>
            {summaryFact ? (
              <Card>
                <CardHeader><CardTitle className="text-base">What the brand does</CardTitle></CardHeader>
                <CardContent className="text-sm">{summaryFact.value}<div className="mt-2 text-xs text-muted-foreground">AI summary of the brand's own pages</div></CardContent>
              </Card>
            ) : null}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Watching for</CardTitle><CardDescription>Names a scammer would put in a domain. Detection matches look-alikes of these.</CardDescription></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {b.seed_terms.length ? b.seed_terms.map((t) => <Mono key={t} className="rounded-md border bg-muted px-2 py-1">{t}</Mono>) : <span className="text-sm text-muted-foreground">None yet</span>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Authorisation letter</CardTitle><CardDescription>Its fingerprint is printed on every notice.</CardDescription></CardHeader>
                <CardContent className="text-sm">
                  {b.authorisation_letter_sha256 ? <div className="grid gap-1"><div><Mono>{b.authorisation_letter_ref}</Mono></div><div><Hash value={b.authorisation_letter_sha256} /></div></div> :
                    <div className="flex items-center gap-3"><Badge variant="warn">none on file</Badge><Button asChild size="sm" variant="outline"><Link to="/brands/$brandId" params={{ brandId: b.id }}>Add it</Link></Button></div>}
                </CardContent>
              </Card>
            </div>
            {p.summary?.steps && Object.keys(p.summary.steps).length ? (
              <Card>
                <CardHeader><CardTitle className="text-base">What the last run did</CardTitle><CardDescription>Steps without a key are skipped, not failed.</CardDescription></CardHeader>
                <CardContent><ProfileSteps steps={p.summary.steps as never} /></CardContent>
              </Card>
            ) : null}
          </TabsContent>

          {(['identity', 'domains', 'presence', 'contact', 'press', 'sources'] as const).map((g) => (
            <TabsContent key={g} value={g} className="mt-4">
              <Section facts={facts(GROUPS[g].kinds)} brandId={b.id} empty={GROUPS[g].empty} />
            </TabsContent>
          ))}

          <TabsContent value="people" className="mt-4">
            <Card className="gap-0 py-0">
              {p.people.length ? (
                <ul>
                  {p.people.map((x) => (
                    <li key={x.id} className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{x.name}</div>
                        <div className="text-sm text-muted-foreground">{x.title || 'Role not stated'}</div>
                        <div className="text-xs text-muted-foreground">{x.collector}{x.source_url ? <> · <a href={x.source_url} target="_blank" rel="noreferrer">source</a></> : null}</div>
                      </div>
                      <VerificationBadge v={x.verification} />
                    </li>
                  ))}
                </ul>
              ) : <div className="p-4"><Empty>No leadership found yet. Business roles only, taken from the brand's own pages or its LinkedIn page.</Empty></div>}
            </Card>
          </TabsContent>

          <TabsContent value="logos" className="mt-4">
            {p.assets.length ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {p.assets.map((a) => (
                  <Card key={a.id} className="gap-3 py-4">
                    <CardContent className="grid gap-3 px-4">
                      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md border bg-muted/40">
                        {a.url?.startsWith('http') || a.url?.startsWith('data:') ? <img src={a.url} alt={`${a.kind} of ${b.display_name}`} loading="lazy" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">fingerprint only</span>}
                      </div>
                      <div className="grid gap-0.5 text-xs">
                        <Badge variant="outline" className="w-fit">{a.kind}</Badge>
                        {a.phash ? <div className="text-muted-foreground">perceptual hash <Mono>{a.phash}</Mono></div> : null}
                        {a.mmh3 != null ? <div className="text-muted-foreground">favicon hash <Mono>{a.mmh3}</Mono></div> : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : <Empty>No logos or favicon captured yet. Their fingerprints are how detection spots a copied logo.</Empty>}
          </TabsContent>
        </Tabs>
      ) : null}
    </Page>
  )
}
