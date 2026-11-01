// Sample-data implementation of the /api/brands routes: a pre-profiled fictional brand and a simulated profiling run for any new brand.
import { ApiError, type BrandSummary, type JobStatus, type NextAction, type SetupState, type SweepStatus, type ProfileAsset, type ProfileFact, type ProfilePerson, type StepState, type VerifyInstructions } from '@/api'
import { BRAND, fakeHash, hoursAgo, iso, rid } from './data'

export interface BrandState {
  brands: BrandSummary[]
  verification: Record<string, VerifyInstructions>
  facts: Record<string, ProfileFact[]>
  people: Record<string, ProfilePerson[]>
  assets: Record<string, ProfileAsset[]>
  jobs: Record<string, JobStatus>
  verifyChecks: Record<string, number>
  sweeps?: Record<string, SweepStatus>
}

export interface MockCounts { threats: number; awaiting: number; approved: number }

const STEPS = ['inputs', 'dns', 'rdap', 'website', 'assets', 'linkedin', 'socials', 'news', 'dossier']

const logoSvg = (initials: string, color: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120"><rect width="240" height="120" rx="16" fill="${color}"/><text x="120" y="72" font-family="Arial" font-size="44" font-weight="700" fill="#fff" text-anchor="middle">${initials}</text></svg>`)}`

function fact(_brandId: string, kind: string, value: string, o: Partial<ProfileFact> = {}): ProfileFact {
  return {
    id: rid('fact'), kind, value, label: null, data: {}, source_url: null, collector: 'website', confidence: 0.8, verification: 'corroborated',
    review_status: 'pending', needs_confirmation: ['phone', 'wallet', 'bank_account', 'social', 'telegram', 'whatsapp'].includes(kind), fetched_at: hoursAgo(2), ...o,
      }
}

export function seedBrandState(): BrandState {
  const id = BRAND.brand_id
  const site = 'https://nkwaex.com'
  const summary: BrandSummary = {
    id, display_name: BRAND.display_name, website: 'nkwaex.com', linkedin_url: 'https://www.linkedin.com/company/nkwa-exchange', status: 'ready',
    ownership_status: 'verified', verified_at: hoursAgo(80), fictional: true, authorisation_letter_ref: BRAND.authorisation_letter.ref,
    authorisation_letter_sha256: BRAND.authorisation_letter.sha256, seed_terms: BRAND.seed_terms, active_version: 1, is_active: true, created_at: hoursAgo(90), updated_at: hoursAgo(2),
  }
  const confirmed = { review_status: 'confirmed' as const }
  const facts: ProfileFact[] = [
    fact(id, 'domain', 'nkwaex.com', { collector: 'user', verification: 'verified', ...confirmed, label: 'Primary domain', source_url: site, confidence: 1 }),
    fact(id, 'trading_name', 'Nkwa Exchange', { collector: 'user', verification: 'verified', ...confirmed, label: 'Brand name as entered', confidence: 1 }),
    fact(id, 'legal_name', 'Nkwa Exchange Limited', { collector: 'llm_extraction', label: 'Extracted from the site, cited', source_url: `${site}/about` }),
    fact(id, 'registration_no', 'CS-DEMO-0001', { collector: 'llm_extraction', label: 'Extracted from the site, cited', source_url: `${site}/legal`, verification: 'conflicting' }),
    fact(id, 'registration_no', 'CS-DEMO-0002', { collector: 'search', label: 'Reported in a press article', source_url: 'https://example.com/sample-news-2', verification: 'conflicting', confidence: 0.5 }),
    fact(id, 'licence', 'Virtual asset service provider licence (demo, fictional)', { collector: 'llm_extraction', label: 'Regulator named on the Legal page', source_url: `${site}/legal` }),
    fact(id, 'hq_address', 'Ring Road Central, Accra, Ghana', { collector: 'website', label: 'Address in structured data', source_url: site }),
    fact(id, 'dns', 'nkwaex.com', { collector: 'dns', verification: 'single_source', label: 'DNS records', data: { email_provider: 'Google Workspace', ns: ['a', 'b'], a: ['203.0.113.10'], spf: 'v=spf1 include:_spf.google.com ~all' } }),
    fact(id, 'domain_registration', 'nkwaex.com', { collector: 'rdap', verification: 'single_source', label: 'Registrar and hosting', data: { registrar: 'Sample Registrar Ltd', created: '2023-04-12', hosting_network: 'Sample Cloud' } }),
    fact(id, 'social', 'https://x.com/nkwaex', { collector: 'user', verification: 'verified', ...confirmed, label: 'x @nkwaex', data: { platform: 'x', handle: 'nkwaex' }, source_url: 'https://x.com/nkwaex', confidence: 1 }),
    fact(id, 'social', 'https://www.linkedin.com/company/nkwa-exchange', { collector: 'user', verification: 'verified', ...confirmed, label: 'linkedin @nkwa-exchange', data: { platform: 'linkedin', handle: 'nkwa-exchange' }, confidence: 1 }),
    fact(id, 'social', 'https://instagram.com/nkwaexchange', { collector: 'website', label: 'instagram @nkwaexchange', data: { platform: 'instagram', handle: 'nkwaexchange' }, source_url: site }),
    fact(id, 'telegram', 'https://t.me/nkwaexchange_official', { collector: 'telegram_public', verification: 'single_source', label: 'Nkwa Exchange (official) (channel)', data: { kind: 'channel', audience: 18400, description: 'Official announcements. We never DM first.' }, source_url: 'https://t.me/nkwaexchange_official' }),
    fact(id, 'linkedin_profile', 'https://www.linkedin.com/company/nkwa-exchange', { collector: 'apify:linkedin', verification: 'single_source', label: 'Nkwa Exchange', data: { followers: 5200, employees: 48, industry: 'Financial services', tagline: 'Digital assets, done properly.' } }),
    fact(id, 'app', 'https://play.google.com/store/apps/details?id=com.nkwaex.app', { collector: 'website', label: 'android app com.nkwaex.app', source_url: site }),
    fact(id, 'phone', '0302000000', { collector: 'yaml', verification: 'verified', ...confirmed, label: 'Official number', confidence: 1 }),
    fact(id, 'phone', '0244555000', { collector: 'website', label: 'Phone number on the site', source_url: `${site}/contact` }),
    fact(id, 'email', 'support@nkwaex.com', { collector: 'website', label: 'Email on the site', source_url: `${site}/contact` }),
    fact(id, 'warning', 'https://example.com/sample-news-1', { collector: 'search', verification: 'single_source', label: 'Sample: Nkwa Exchange warns customers about a fake airdrop site', data: { snippet: 'The exchange said it never runs airdrops and asked customers to report look-alike sites.', source: 'example.com', age: '3 weeks ago' }, source_url: 'https://example.com/sample-news-1', confidence: 0.6 }),
    fact(id, 'news', 'https://example.com/sample-news-3', { collector: 'search', verification: 'single_source', label: 'Sample: Nkwa Exchange opens a Kumasi support hub', data: { snippet: 'The company expanded its customer support team.', source: 'example.com', age: '2 months ago' }, source_url: 'https://example.com/sample-news-3', confidence: 0.6 }),
    fact(id, 'summary', 'Nkwa Exchange is a fictional Ghanaian digital-asset exchange used to demonstrate HAUL16. It lets customers buy and sell crypto assets with mobile money.', { collector: 'llm_extraction', label: 'Neutral summary', confidence: 0.6 }),
    ...['', '/about', '/contact', '/legal'].map((path) => fact(id, 'source', `${site}${path}`, { collector: 'website', verification: 'corroborated', label: path ? `Nkwa Exchange | ${path.slice(1)}` : 'Nkwa Exchange | Buy and sell digital assets', source_url: `${site}${path}`, confidence: 1 })),
  ]
  const steps: Record<string, StepState> = Object.fromEntries(STEPS.map((s) => [s, { status: 'ok' } as StepState]))
  steps.linkedin = { status: 'skipped', reason: 'APIFY_TOKEN is not set (sample data)' }
  steps.news = { status: 'ok', news: 1, warnings: 1 }
  steps.website = { status: 'ok', pages: 4 }
  return {
    brands: [summary], verification: { [id]: { domain: 'nkwaex.com', record_name: '_haul16-verify.nkwaex.com', record_type: 'TXT', record_value: 'haul16-verify=demo000000000000000000' } },
    facts: { [id]: facts },
    people: { [id]: [
      { id: rid('person'), name: 'Kofi Mensah', title: 'Chief Executive Officer', profile_url: null, photo_url: null, bio: null, source_url: `${site}/about`, collector: 'llm_extraction', verification: 'corroborated', review_status: 'pending' },
      { id: rid('person'), name: 'Efua Asante', title: 'Chief Technology Officer', profile_url: null, photo_url: null, bio: null, source_url: `${site}/about`, collector: 'llm_extraction', verification: 'corroborated', review_status: 'pending' },
    ] },
    assets: { [id]: [
      { id: rid('asset'), kind: 'logo', url: logoSvg('NKWA', '#1d4ed8'), sha256: fakeHash('nkwa-logo'), phash: 'f4a28779db70208f', mmh3: null, meta: {}, source_url: site },
      { id: rid('asset'), kind: 'favicon', url: logoSvg('N', '#1d4ed8'), sha256: fakeHash('nkwa-fav'), phash: null, mmh3: 834202372, meta: {}, source_url: site },
    ] },
    jobs: { [id]: { id: 1, status: 'done', steps, version: 1 } },
    verifyChecks: {},
  }
}

function factCounts(bs: BrandState, id: string) {
  const out: Record<string, number> = {}
  for (const f of bs.facts[id] ?? []) out[f.kind] = (out[f.kind] ?? 0) + 1
  return out
}

const domainOf = (u: string) => (u.replace(/^https?:\/\//, '').split('/')[0] || u).toLowerCase().replace(/^www\./, '')
const seedTerms = (name: string, domain?: string) => {
  const t = [name.toLowerCase().replace(/[^a-z0-9]/g, ''), domain ? domainOf(domain).split('.')[0].replace(/[^a-z0-9]/g, '') : '']
  return [...new Set(t.filter((x) => x.length >= 4))]
}

function setupState(bs: BrandState, b: BrandSummary, counts: MockCounts): SetupState {
  const facts = bs.facts[b.id] ?? []
  const undecided = facts.filter((f) => f.review_status === 'pending' && (f.needs_confirmation || f.verification === 'conflicting')).length
  const ready = b.status === 'ready', running = b.status === 'profiling'
  const verified = b.ownership_status === 'verified', letter = !!b.authorisation_letter_sha256, active = b.is_active
  const plural = (n: number) => (n === 1 ? '' : 's')
  const review: NextAction = { key: 'review_facts', title: `Confirm ${undecided} detail${plural(undecided)} we found`, detail: 'Phone numbers, accounts and wallets are only used once you confirm them.', href: '/setup?step=2', count: undecided }
  const prove: NextAction = { key: 'prove_ownership', title: "Prove it's your brand", detail: 'Required before any notice can be filed: verify your domain and add the signed authorisation letter.', href: '/setup?step=3' }
  let next: NextAction
  if (!ready) next = { key: 'wait_profile', title: "Reading your brand's public footprint", detail: 'This takes about a minute. You can leave this page.', href: '/setup?step=2' }
  else if (!active) next = undecided ? review : { key: 'start_protection', title: 'Start protecting your brand', detail: 'HAUL16 will watch for look-alike sites and scan for ones that already exist.', href: '/setup?step=4' }
  else if (counts.awaiting) next = { key: 'review_notices', title: `Approve ${counts.awaiting} takedown notice${plural(counts.awaiting)}`, detail: 'Each one needs a person to approve it before it can be filed.', href: '/approvals', count: counts.awaiting }
  else if (counts.approved && verified && letter) next = { key: 'file_notices', title: `File ${counts.approved} approved notice${plural(counts.approved)}`, detail: 'Filing is a dry run for now: nothing is sent, and the takedown clock starts.', href: '/approvals?status=approved', count: counts.approved }
  else if (counts.approved) next = prove
  else if (undecided) next = review
  else if (!(verified && letter)) next = prove
  else next = { key: 'all_clear', title: 'All clear', detail: 'Nothing needs you right now. HAUL16 keeps watching.', href: '/home' }
  return {
    brand_id: b.id, step: !(ready && !undecided) ? 2 : !(verified && letter) ? 3 : 4, complete: active,
    steps: { brand: { done: true }, profile: { done: ready, running }, review: { done: !undecided, count: undecided }, ownership: { done: verified }, letter: { done: letter }, protection: { done: active } },
    next_action: next, sweep: bs.sweeps?.[b.id] ?? { status: 'none' }, counts,
    patrol: { hours: b.patrol_hours ?? 6, next_at: b.patrol_hours === 0 ? null : iso(Date.now() + (b.patrol_hours ?? 6) * 3_600_000) },
  }
}

/** Simulated look-alike scan. Sample data only: it does not create findings. */
function startSweep(bs: BrandState, id: string, save: () => void) {
  bs.sweeps ??= {}
  const total = 324
  const skip = (reason: string) => ({ label: '', status: 'skipped' as const, reason: `${reason} (sample data)` })
  const sources = () => ({
    dns_sweep: { label: 'Look-alike domains', status: 'running' as const },
    ct_history: { label: 'Certificate history', status: 'pending' as const },
    telegram_handles: { label: 'Telegram accounts', status: 'pending' as const },
    urlscan: { ...skip('URLSCAN_API_KEY is not set'), label: 'urlscan.io' },
    web_search: { ...skip('SEARCH_API_KEY is not set'), label: 'Web search' },
    news_mentions: { ...skip('SEARCH_API_KEY is not set'), label: 'Press warnings' },
    meta_ads: { ...skip('META_AD_LIBRARY_TOKEN is not set'), label: 'Meta ads' },
  })
  bs.sweeps[id] = { status: 'running', phase: 'checking', generated: total, checked: 0, registered: 0, queued: 0, skipped_known: 0, sources: sources() }
  const t = setInterval(() => {
    const s = bs.sweeps![id]
    s.checked = Math.min(total, (s.checked ?? 0) + 27)
    s.registered = Math.round((s.checked / total) * 6)
    const src = s.sources!
    src.dns_sweep = { ...src.dns_sweep, status: s.checked >= total ? 'ok' : 'running', generated: total, checked: s.checked, registered: s.registered, found: s.registered, queued: 0 }
    if (s.checked >= total * 0.4 && src.ct_history.status === 'pending') src.ct_history = { ...src.ct_history, status: 'ok', found: 3, queued: 0 }
    if (s.checked >= total * 0.7 && src.telegram_handles.status === 'pending') src.telegram_handles = { ...src.telegram_handles, status: 'ok', checked: 80, existing: 4, found: 0, queued: 0 }
    if (s.checked >= total) {
      src.ct_history.status = 'ok'; src.telegram_handles.status = 'ok'
      Object.assign(s, { status: 'done', phase: 'done', queued: 0, updated_at: iso(Date.now()) })
      clearInterval(t)
      save()
    }
  }, 350)
}

export function handleBrandRoute(bs: BrandState, method: string, seg: string[], body: any, save: () => void, counts: MockCounts = { threats: 0, awaiting: 0, approved: 0 }): any {
  // seg: ['brands', ...]
  const id = seg[1]
  const need = () => bs.brands.find((b) => b.id === id) ?? (() => { throw new ApiError(404, 'No such brand') })()

  if (!id) {
    if (method === 'GET') return bs.brands.map((b) => ({ ...b, fact_counts: factCounts(bs, b.id) }))
    if (method === 'POST') {
      const name = String(body.display_name ?? '').trim()
      if (name.length < 2) throw new ApiError(422, 'String should have at least 2 characters')
      if (!body.website && !body.linkedin_url) throw new ApiError(422, 'Enter a website or a LinkedIn page so there is something to build the profile from')
      const b: BrandSummary = {
        id: rid('brand'), display_name: name, website: body.website ?? null, linkedin_url: body.linkedin_url ?? null, status: 'draft', ownership_status: 'unverified',
        verified_at: null, fictional: false, authorisation_letter_ref: null, authorisation_letter_sha256: null, seed_terms: seedTerms(name, body.website),
        active_version: null, is_active: false, created_at: iso(Date.now()), updated_at: iso(Date.now()),
      }
      const dom = b.website ? domainOf(b.website) : null
      bs.brands.push(b)
      bs.verification[b.id] = { domain: dom, record_name: dom ? `_haul16-verify.${dom}` : null, record_type: 'TXT', record_value: `haul16-verify=${rid('t').slice(2)}${rid('t').slice(2)}` }
      bs.facts[b.id] = []; bs.people[b.id] = []; bs.assets[b.id] = []
      ;(b as any)._inputs = { socials: body.socials ?? [], extra_domains: body.extra_domains ?? [] }
      save()
      return { ...b, verification: bs.verification[b.id] }
    }
  }
  const b = need()
  const sub = seg[2]
  if (!sub && method === 'DELETE') {
    bs.brands = bs.brands.filter((x) => x.id !== b.id)
    save()
    return { deleted: b.id }
  }
  if (!sub && method === 'PATCH') {
    if (!body.seed_terms && typeof body.patrol_hours === 'number') { b.patrol_hours = body.patrol_hours; save(); return b }
    const terms = [...new Set<string>((body.seed_terms ?? []).map((t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '')).filter((t: string) => t.length >= 4))]
    if (!terms.length) throw new ApiError(422, 'Add at least one name of 4 or more letters or digits')
    if (body.seed_terms) b.seed_terms = terms
    if (typeof body.patrol_hours === 'number') b.patrol_hours = body.patrol_hours
    save()
    return b
  }
  if (sub === 'setup' && method === 'GET') return setupState(bs, b, counts)
  if (sub === 'sweep') {
    if (method === 'GET' || seg[3] === 'status') return bs.sweeps?.[b.id] ?? { status: 'none' }
    if (b.status !== 'ready') throw new ApiError(409, "Build the brand's profile first")
    if (!b.is_active) throw new ApiError(409, 'Start protection first. Detection must be watching this brand.')
    if (bs.sweeps?.[b.id]?.status !== 'running') startSweep(bs, b.id, save)
    return bs.sweeps![b.id]
  }
  if (!sub && method === 'GET') return { ...b, verification: bs.verification[b.id], job: bs.jobs[b.id] ?? null }
  if (sub === 'profile') {
    if (seg[3] === 'run' && method === 'POST') {
      const cur = bs.jobs[b.id]
      if (cur && (cur.status === 'queued' || cur.status === 'running')) return cur
      startProfile(bs, b, save)
      return bs.jobs[b.id]
    }
    if (seg[3] === 'status') return bs.jobs[b.id] ?? { status: 'none', steps: {} }
    const facts = bs.facts[b.id] ?? []
    const groups: Record<string, ProfileFact[]> = {}
    for (const f of facts) (groups[f.kind] ??= []).push(f)
    return {
      brand: { ...b, verification: bs.verification[b.id] }, job: bs.jobs[b.id] ?? null, groups, people: bs.people[b.id] ?? [], assets: bs.assets[b.id] ?? [],
      summary: bs.jobs[b.id]?.status === 'done' ? { steps: bs.jobs[b.id].steps, counts: factCounts(bs, b.id) } : null,
      conflicts: facts.filter((f) => f.verification === 'conflicting').map((f) => f.id),
      needs_review: facts.filter((f) => f.needs_confirmation && f.review_status === 'pending').map((f) => f.id),
    }
  }
  if (sub === 'verify' && method === 'POST') {
    const n = (bs.verifyChecks[b.id] = (bs.verifyChecks[b.id] ?? 0) + 1)
    if (b.ownership_status === 'verified' || n >= 2) {
      Object.assign(b, { ownership_status: 'verified', verified_at: iso(Date.now()) })
      save()
      return { verified: true, domain: bs.verification[b.id].domain }
    }
    return { verified: false, domain: bs.verification[b.id].domain, reason: `No TXT record containing the token was found on ${bs.verification[b.id].domain} or _haul16-verify.${bs.verification[b.id].domain} yet. DNS changes can take a few minutes. (Sample data: the second check succeeds.)` }
  }
  if (sub === 'facts' && method === 'POST') {
    const f = (bs.facts[b.id] ?? []).find((x) => x.id === seg[3])
    if (!f || !['confirm', 'reject'].includes(seg[4])) throw new ApiError(404, 'No such fact')
    f.review_status = seg[4] === 'confirm' ? 'confirmed' : 'rejected'
    save()
    return { ok: true }
  }
  if (sub === 'letter' && method === 'POST') {
    const sha = fakeHash(String(body.content_base64 ?? ''))
    Object.assign(b, { authorisation_letter_ref: String(body.filename ?? 'letter').slice(0, 80), authorisation_letter_sha256: sha })
    save()
    return { ref: b.authorisation_letter_ref, sha256: sha, bytes: String(body.content_base64 ?? '').length * 0.75 }
  }
  if (sub === 'activate' && method === 'POST') {
    if (b.status !== 'ready') throw new ApiError(409, "Build the brand's profile first")
    bs.brands.forEach((x) => (x.is_active = x.id === b.id))
    if (bs.sweeps?.[b.id]?.status !== 'running') startSweep(bs, b.id, save)
    save()
    return { active: b.id, sweep: bs.sweeps![b.id] }
  }
  throw new ApiError(404, `Not found: ${method} /${seg.join('/')}`)
}

function startProfile(bs: BrandState, b: BrandSummary, save: () => void) {
  const steps: Record<string, StepState> = Object.fromEntries(STEPS.map((s) => [s, { status: 'pending' } as StepState]))
  const version = (b.active_version ?? 0) + 1
  bs.jobs[b.id] = { id: Date.now() % 100000, status: 'running', steps, version: null }
  b.status = 'profiling'
  const inputs = ((b as any)._inputs ?? { socials: [], extra_domains: [] }) as { socials: string[]; extra_domains: string[] }
  const outcome: Record<string, StepState> = {
    inputs: { status: 'ok', facts: 1 + inputs.socials.length }, dns: { status: 'ok', records: 6 }, rdap: { status: 'ok', records: 1 },
    website: { status: 'ok', pages: 4, firecrawl: false }, assets: { status: 'ok', assets: 2 },
    linkedin: { status: 'skipped', reason: 'APIFY_TOKEN is not set (sample data)' },
    socials: { status: 'skipped', reason: 'no public Telegram handle found and no APIFY_SOCIAL_ACTOR configured (sample data)' },
    news: { status: 'skipped', reason: 'SEARCH_API_KEY is not set (sample data)' },
    dossier: { status: 'skipped', reason: "no API key set for LLM provider 'openai' (sample data)" },
  }
  STEPS.forEach((name, i) => {
    setTimeout(() => { steps[name] = { status: 'running' }; }, i * 900)
    setTimeout(() => { steps[name] = outcome[name]; if (i === STEPS.length - 1) finish() }, i * 900 + 700)
  })
  function finish() {
    const id = b.id, dom = b.website ? domainOf(b.website) : null
    const add = (f: ProfileFact) => { const l = (bs.facts[id] ??= []); if (!l.some((x) => x.kind === f.kind && x.value === f.value)) l.push(f) }
    if (dom) add(fact(id, 'domain', dom, { collector: 'user', verification: 'verified', review_status: 'confirmed', label: 'Primary domain', confidence: 1, source_url: `https://${dom}` }))
    add(fact(id, 'trading_name', b.display_name, { collector: 'user', verification: 'verified', review_status: 'confirmed', label: 'Brand name as entered', confidence: 1 }))
    for (const u of [b.linkedin_url, ...inputs.socials].filter(Boolean) as string[]) {
      const platform = /linkedin/.test(u) ? 'linkedin' : /t\.me/.test(u) ? 'telegram' : /x\.com|twitter/.test(u) ? 'x' : /instagram/.test(u) ? 'instagram' : /facebook/.test(u) ? 'facebook' : /tiktok/.test(u) ? 'tiktok' : /youtube/.test(u) ? 'youtube' : 'social'
      add(fact(id, 'social', u, { collector: 'user', verification: 'verified', review_status: 'confirmed', label: `${platform} account you entered`, data: { platform }, confidence: 1, source_url: u }))
    }
    for (const d of inputs.extra_domains) add(fact(id, 'domain', domainOf(d), { collector: 'user', verification: 'verified', review_status: 'confirmed', label: 'Additional domain', confidence: 1 }))
    if (dom) {
      add(fact(id, 'dns', dom, { collector: 'dns', verification: 'single_source', label: 'DNS records (sample)', data: { email_provider: 'Sample provider', ns: ['ns1', 'ns2'], a: ['203.0.113.7'] } }))
      for (const p of ['', '/about', '/contact', '/legal']) add(fact(id, 'source', `https://${dom}${p}`, { collector: 'website', verification: 'corroborated', label: p ? `${b.display_name} | ${p.slice(1)}` : `${b.display_name} | home`, confidence: 1, source_url: `https://${dom}${p}` }))
    }
    bs.assets[id] = [{ id: rid('asset'), kind: 'logo', url: logoSvg(b.display_name.slice(0, 4).toUpperCase(), '#5b3df5'), sha256: fakeHash(b.display_name), phash: fakeHash(b.display_name).slice(0, 16), mmh3: null, meta: {}, source_url: null }]
    b.status = 'ready'; b.active_version = version; b.updated_at = iso(Date.now())
    bs.jobs[id] = { ...bs.jobs[id], status: 'done', version }
    save()
  }
}
