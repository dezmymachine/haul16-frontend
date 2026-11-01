import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { api, type ProfileFact } from '@/api'
import { useBrands } from '@/brand'
import { ErrorNote, Mono } from '@/ui'
import { FactRow } from '@/components/fact-row'
import { OwnershipCard, LetterCard } from '@/components/brand-proof'
import { ProfileSteps } from '@/components/profile-steps'
import { UserMenu } from '@/components/user-menu'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type Step = 1 | 2 | 3 | 4
export const Route = createFileRoute('/setup')({
  validateSearch: (s: Record<string, unknown>): { step?: Step; new?: boolean } => ({
    step: [1, 2, 3, 4].includes(Number(s.step)) ? (Number(s.step) as Step) : undefined,
    new: s.new === true || s.new === 'true' || s.new === 1 || s.new === '1' ? true : undefined,
  }),
  component: SetupPage,
})

const STEPS = ['Your brand', 'What we found', "Prove it's yours", 'Start protection']
const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)

function SetupPage() {
  const { step: stepParam, new: isNew } = Route.useSearch()
  const nav = useNavigate()
  const { current, isPending } = useBrands()
  const bid = isNew ? undefined : current?.id
  const setup = useQuery({
    queryKey: ['setup', bid], queryFn: () => api.setup(bid!), enabled: !!bid,
    refetchInterval: (q) => (q.state.data?.steps.profile.running ? 1500 : 5000),
  })
  const s = setup.data

  // No brand yet (or adding another) starts at step 1. A finished setup opens Home unless a step was asked for.
  const step: Step = !bid ? 1 : (stepParam ?? s?.step ?? 2)
  useEffect(() => {
    if (bid && s?.complete && !stepParam) nav({ to: '/home', replace: true })
  }, [bid, s?.complete, stepParam, nav])

  const go = (n: Step) => nav({ to: '/setup', search: { step: n }, replace: false })
  const done = (n: Step) => (n === 1 ? !!bid : n === 2 ? !!s?.steps.profile.done : n === 3 ? !!(s?.steps.ownership.done && s?.steps.letter.done) : !!s?.complete)
  const canOpen = (n: Step) => n === 1 ? !!bid : !!bid && (n <= (s?.step ?? 2) || done(n - 1 as Step) || n === 2)

  if (isPending || (bid && !s)) return <Shell step={step} done={() => false} canOpen={() => false} go={go}><Skeleton className="h-72 w-full" /></Shell>
  return (
    <Shell step={step} done={done} canOpen={canOpen} go={go}>
      {step === 1 ? <StepBrand /> : null}
      {step === 2 && bid && s ? <StepFound brandId={bid} onBack={() => go(1)} onNext={() => go(3)} /> : null}
      {step === 3 && bid && s ? <StepProve brandId={bid} complete={s.steps.ownership.done && s.steps.letter.done} onBack={() => go(2)} onNext={() => go(4)} /> : null}
      {step === 4 && bid && s ? <StepStart brandId={bid} onBack={() => go(3)} /> : null}
    </Shell>
  )
}

function Shell({ step, done, canOpen, go, children }: { step: Step; done: (n: Step) => boolean; canOpen: (n: Step) => boolean; go: (n: Step) => void; children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-background">
      <header className="flex items-center justify-between gap-4 border-b bg-card px-4 py-3 md:px-8">
        <Link to="/home" className="text-xl font-extrabold tracking-tight text-foreground">HAUL16</Link>
        <UserMenu />
      </header>
      <main className="mx-auto grid w-full max-w-3xl gap-8 p-4 md:p-8">
        <nav aria-label="Setup progress">
          <ol className="grid grid-cols-4 gap-2">
            {STEPS.map((label, i) => {
              const n = (i + 1) as Step
              const isDone = done(n), isCurrent = n === step, open = canOpen(n)
              return (
                <li key={label}>
                  <button
                    disabled={!open}
                    onClick={() => go(n)}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={cn('grid w-full gap-1 border-t-4 pt-2 text-left', isDone ? 'border-emerald-600' : isCurrent ? 'border-primary' : 'border-border', !open && 'cursor-not-allowed opacity-60')}
                  >
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {isDone ? <Check className="size-3.5 text-emerald-600" /> : <span className="tabular-nums">{n}</span>}
                    </span>
                    <span className={cn('text-sm font-medium max-sm:text-xs', isCurrent ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>
        {children}
      </main>
    </div>
  )
}

function Footer({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 pt-2">{children}</div>
}

// ---- 1. Your brand -------------------------------------------------------------------

function StepBrand() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const { select } = useBrands()
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [more, setMore] = useState(false)
  const [socials, setSocials] = useState('')
  const [domains, setDomains] = useState('')
  const create = useMutation({
    mutationFn: async () => {
      const b = await api.brandCreate({ display_name: name.trim(), website: website.trim() || undefined, linkedin_url: linkedin.trim() || undefined, socials: lines(socials), extra_domains: lines(domains) })
      await api.profileRun(b.id)
      return b
    },
    onSuccess: async (b) => {
      await qc.invalidateQueries({ queryKey: ['brands'] })
      select(b.id)
      nav({ to: '/setup', search: { step: 2 }, replace: true })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <form className="grid gap-6" onSubmit={(e) => { e.preventDefault(); create.mutate() }}>
      <div className="grid gap-2">
        <h1 className="text-[clamp(1.75rem,1.2rem+2vw,2.25rem)] font-bold tracking-tight">Tell us about your brand</h1>
        <p className="max-w-xl text-muted-foreground">HAUL16 reads what your brand publishes (website, registrar, logos, social accounts, press) and builds the profile it protects.</p>
      </div>
      <Card>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="b-name">Brand name</Label>
            <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Pay" required minLength={2} autoFocus />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="b-site">Website</Label>
            <Input id="b-site" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acmepay.com" />
            <p className="text-xs text-muted-foreground">Its domain becomes your first official domain. You will prove you control it in step 3.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="b-li">LinkedIn company page <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="b-li" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://www.linkedin.com/company/acme-pay" />
          </div>
          {more ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="b-soc">Other official accounts</Label>
                <Textarea id="b-soc" value={socials} onChange={(e) => setSocials(e.target.value)} rows={3} placeholder={'https://x.com/acmepay\nhttps://t.me/acmepay'} />
                <p className="text-xs text-muted-foreground">One link per line: X, Facebook, Instagram, TikTok, YouTube, Telegram, WhatsApp channel.</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="b-dom">Other official domains</Label>
                <Textarea id="b-dom" value={domains} onChange={(e) => setDomains(e.target.value)} rows={2} placeholder="acmepay.com.gh" />
              </div>
            </>
          ) : (
            <Button type="button" variant="link" className="justify-self-start px-0" onClick={() => setMore(true)}><Plus /> Add more accounts or domains</Button>
          )}
        </CardContent>
      </Card>
      <Footer>
        <span className="text-xs text-muted-foreground">Only public information is read. Nothing is sent anywhere.</span>
        <Button type="submit" size="lg" disabled={create.isPending || name.trim().length < 2 || !(website.trim() || linkedin.trim())}>
          {create.isPending ? 'Adding…' : 'Continue'} <ArrowRight />
        </Button>
      </Footer>
    </form>
  )
}

// ---- 2. What we found ----------------------------------------------------------------

function StepFound({ brandId, onBack, onNext }: { brandId: string; onBack: () => void; onNext: () => void }) {
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['profile', brandId], queryFn: () => api.profile(brandId),
    refetchInterval: (query) => { const d = query.state.data; return d && (d.brand.status !== 'ready' || ['queued', 'running'].includes(d.job?.status ?? '')) ? 1500 : false },
  })
  const rerun = useMutation({ mutationFn: () => api.profileRun(brandId), onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', brandId] }) })
  const p = q.data
  const building = !p || p.brand.status !== 'ready'
  const facts = Object.values(p?.groups ?? {}).flat()
  const undecided: ProfileFact[] = facts.filter((f) => f.review_status === 'pending' && (f.needs_confirmation || f.verification === 'conflicting'))
  const total = facts.filter((f) => f.kind !== 'source').length
  const pages = p?.groups.source?.length ?? 0
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-[clamp(1.75rem,1.2rem+2vw,2.25rem)] font-bold tracking-tight">{building ? 'Reading your brand’s public footprint' : 'Here is what we found'}</h1>
        <p className="max-w-xl text-muted-foreground">{building ? 'This takes about a minute. You can leave this page and come back.' : `${total} details from ${pages} pages and public records. Confirm the ones that matter.`}</p>
      </div>
      <ErrorNote error={q.error} />
      {building ? (
        <Card><CardContent>{p?.job ? <ProfileSteps steps={p.job.steps} /> : <Skeleton className="h-48 w-full" />}</CardContent></Card>
      ) : (
        <>
          {undecided.length ? (
            <Card className="gap-0 py-0">
              <CardHeader className="border-b py-4">
                <CardTitle className="text-base">{undecided.length} to confirm</CardTitle>
                <CardDescription>Numbers, accounts and wallets are only used for detection once you confirm they are really yours.</CardDescription>
              </CardHeader>
              <ul>{undecided.map((f) => <FactRow key={f.id} f={f} brandId={brandId} />)}</ul>
            </Card>
          ) : (
            <Alert><AlertTitle>Nothing needs your decision</AlertTitle><AlertDescription>Everything we found is either confirmed or not used for matching. You can review it all later under Brand.</AlertDescription></Alert>
          )}
          <p className="text-sm text-muted-foreground">
            Some steps are skipped without an API key (LinkedIn, press, AI extraction). The full detail and what was skipped are under Brand once you are in.
            <Button variant="link" className="px-1" onClick={() => rerun.mutate()}>Run it again</Button>
          </p>
        </>
      )}
      <Footer>
        <Button variant="ghost" onClick={onBack}><ArrowLeft /> Back</Button>
        <Button size="lg" disabled={building} onClick={onNext}>{undecided.length ? 'Skip for now' : 'Continue'} <ArrowRight /></Button>
      </Footer>
    </div>
  )
}

// ---- 3. Prove it's yours -------------------------------------------------------------

function StepProve({ brandId, complete, onBack, onNext }: { brandId: string; complete: boolean; onBack: () => void; onNext: () => void }) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-[clamp(1.75rem,1.2rem+2vw,2.25rem)] font-bold tracking-tight">Prove it’s your brand</h1>
        <p className="max-w-xl text-muted-foreground">Registrars and platforms only act for the brand owner or its authorised agent. Both of these are needed before a notice can be filed.</p>
      </div>
      <OwnershipCard brandId={brandId} />
      <LetterCard brandId={brandId} />
      {!complete ? (
        <Alert><AlertTitle>You can do this later</AlertTitle><AlertDescription>Protection and scanning work without it, but <strong>filing is locked</strong> until the domain is verified and the letter is uploaded.</AlertDescription></Alert>
      ) : null}
      <Footer>
        <Button variant="ghost" onClick={onBack}><ArrowLeft /> Back</Button>
        <Button size="lg" onClick={onNext}>{complete ? 'Continue' : 'Do this later'} <ArrowRight /></Button>
      </Footer>
    </div>
  )
}

// ---- 4. Start protection -------------------------------------------------------------

function StepStart({ brandId, onBack }: { brandId: string; onBack: () => void }) {
  const nav = useNavigate()
  const qc = useQueryClient()
  const setup = useQuery({ queryKey: ['setup', brandId], queryFn: () => api.setup(brandId) })
  const profile = useQuery({ queryKey: ['profile', brandId], queryFn: () => api.profile(brandId) })
  const brand = profile.data?.brand
  const [terms, setTerms] = useState<string[] | null>(null)
  const [draft, setDraft] = useState('')
  const shown = terms ?? brand?.seed_terms ?? []
  const domains = (profile.data?.groups.domain ?? []).filter((d) => d.review_status !== 'rejected').map((d) => d.value)
  const s = setup.data
  const save = (next: string[]) => {
    setTerms(next)
    api.brandPatch(brandId, { seed_terms: next }).then(() => qc.invalidateQueries({ queryKey: ['profile', brandId] })).catch((e: Error) => toast.error(e.message))
  }
  const start = useMutation({
    mutationFn: () => api.brandActivate(brandId),
    onSuccess: async () => {
      await qc.invalidateQueries()
      toast.success('Protection is on. Scanning for look-alikes now.')
      nav({ to: '/home' })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const todo = [
    s && !s.steps.review.done && `${s.steps.review.count} detail${s.steps.review.count === 1 ? '' : 's'} still to confirm`,
    s && !s.steps.ownership.done && 'domain ownership not verified',
    s && !s.steps.letter.done && 'authorisation letter not uploaded',
  ].filter(Boolean) as string[]
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-[clamp(1.75rem,1.2rem+2vw,2.25rem)] font-bold tracking-tight">{s?.complete ? 'Protection is on' : 'Start protecting your brand'}</h1>
        <p className="max-w-xl text-muted-foreground">HAUL16 watches new certificates for look-alikes of these names and scans for look-alike domains that already exist. Each find is captured, scored and turned into a draft notice for you to approve.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Names it will watch for</CardTitle><CardDescription>Names a scammer would put in a domain. Add or remove any. At least 4 letters or digits each. <strong>Keep only distinctive names:</strong> a common word will also match other, innocent businesses.</CardDescription></CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            {shown.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-md border bg-muted py-1 pr-1 pl-2.5">
                <Mono>{t}</Mono>
                <button aria-label={`Remove ${t}`} className="rounded p-0.5 hover:bg-accent" onClick={() => shown.length > 1 && save(shown.filter((x) => x !== t))}><X className="size-3.5" /></button>
              </span>
            ))}
          </div>
          <form className="flex max-w-sm gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { save([...shown, draft.trim()]); setDraft('') } }}>
            <Input aria-label="Add a name" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a name" />
            <Button type="submit" variant="outline">Add</Button>
          </form>
          {domains.length ? <p className="text-sm text-muted-foreground">Your own domains are never flagged: <Mono>{domains.join(', ')}</Mono></p> : null}
        </CardContent>
      </Card>
      {todo.length && !s?.complete ? (
        <Alert><AlertTitle>Still open, but not blocking</AlertTitle><AlertDescription>{todo.join('; ')}. {(!s?.steps.ownership.done || !s?.steps.letter.done) ? 'Filing stays locked until the domain is verified and the letter is uploaded.' : ''}</AlertDescription></Alert>
      ) : null}
      <Footer>
        <Button variant="ghost" onClick={onBack}><ArrowLeft /> Back</Button>
        {s?.complete ? (
          <Button size="lg" onClick={() => nav({ to: '/home' })}>Go to Home <ArrowRight /></Button>
        ) : (
          <Button size="lg" disabled={start.isPending || !shown.length} onClick={() => start.mutate()}>{start.isPending ? 'Starting…' : 'Start protection'} <ArrowRight /></Button>
        )}
      </Footer>
    </div>
  )
}
