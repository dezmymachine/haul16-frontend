// An in-browser stand-in for the HAUL16 FastAPI backend, used when no backend is reachable (for example a static
// Vercel deploy). It implements every route the UI calls, keeps state in memory (mirrored to localStorage so a
// refresh does not lose a demo in progress), and emits the same live events as the real /api/events stream.
import { ApiError, type CaseDetail, type CaseSummary, type Notice, type NoticeStatus, type Report, type Stats, type Threat } from '@/api'
import type { LiveEvent } from '@/live'
import { handleBrandRoute, seedBrandState } from './brands'
import { seedAlerts } from './data'
import {
  BRAND, BRAND_ID, RULES_VERSION, draftNotices, hoursAgo, iso, makeSeed, mkCapture, mkEnrichment, mkNotice, mkVerdict, rid,
  type DB,
} from './data'

const STORE_KEY = 'haul16.demo.v2'
const LIVE_STATUSES: NoticeStatus[] = ['drafted', 'approved', 'filed_dry_run', 'filed', 'rejected']
const isFiled = (s: string) => s === 'filed_dry_run' || s === 'filed'
const SOURCES = [
  ['dns_sweep', 'Look-alike domains', 'Variants of your domain that exist in DNS', null],
  ['ct_history', 'Certificate history', 'Certificates issued this year containing your names (crt.sh)', null],
  ['telegram_handles', 'Telegram accounts', "Look-alike channels and accounts on Telegram's public pages", null],
  ['urlscan', 'urlscan.io', 'Recent public scans of domains containing your names', 'URLSCAN_API_KEY'],
  ['web_search', 'Web search', 'Fake login and giveaway pages found by search', 'SEARCH_API_KEY'],
  ['news_mentions', 'Press warnings', 'News naming your brand with scam wording, and domains it cites', 'SEARCH_API_KEY'],
  ['meta_ads', 'Meta ads', 'Ads using your name from pages that are not yours', 'META_AD_LIBRARY_TOKEN'],
] as const

function load(): DB {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DB
      parsed.brandState ??= seedBrandState()
      parsed.alerts ??= seedAlerts()
      return parsed
    }
  } catch {
    /* storage blocked or corrupt: start from the seed */
  }
  return { ...makeSeed(), brandState: seedBrandState(), alerts: seedAlerts() }
}

let db: DB = load()
const save = () => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(db))
  } catch {
    /* ignore */
  }
}

// ---- live events -------------------------------------------------------------

type Listener = (ev: LiveEvent) => void
const listeners = new Set<Listener>()
const emit = (ev: LiveEvent) => listeners.forEach((fn) => fn(ev))

const startedAt = Date.now()
let certs = 1_180_000 + Math.floor(Math.random() * 40_000)
let uniq = Math.floor(certs * 0.78)
let rate = 48
let tick: ReturnType<typeof setInterval> | undefined

function ctSnapshot() {
  const elapsed = Math.max((Date.now() - startedAt) / 1000, 1)
  return {
    status: 'live', logs: 5, certs, unique_domains: uniq,
    hits: db.threats.filter((t) => t.source === 'certificate_transparency').length,
    certs_per_s: Math.round((certs / (elapsed + 86_400)) * 10) / 10, uptime_s: Math.round(elapsed + 3_600 * 6), backlog: {},
  }
}

/** Subscribe to the same event types the real SSE stream sends. Starts the CT counters on first use. */
export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  fn({ type: 'ct_stats', ...ctSnapshot(), rate_now: rate })
  if (!tick)
    tick = setInterval(() => {
      rate = Math.max(22, Math.min(88, rate + (Math.random() - 0.5) * 14))
      const add = Math.round(rate * 2)
      certs += add
      uniq += Math.round(add * 0.8)
      emit({ type: 'ct_stats', ...ctSnapshot(), rate_now: Math.round(rate * 10) / 10 })
    }, 2000)
  return () => {
    listeners.delete(fn)
    if (!listeners.size && tick) {
      clearInterval(tick)
      tick = undefined
    }
  }
}

// ---- derived views -------------------------------------------------------------

const caseNotices = (id: string) => db.notices.filter((n) => n.case_id === id)

function caseSummary(c: DB['cases'][number]): CaseSummary {
  const ts = db.threats.filter((t) => t.case_id === c.id)
  return {
    id: c.id, brand_id: BRAND_ID, opened_at: c.opened_at, status: c.status, title: c.title, threat_count: ts.length,
    max_score: ts.length ? Math.max(...ts.map((t) => t.score ?? 0)) : null,
    first_detected: ts.map((t) => t.detected_at).sort()[0] ?? c.opened_at,
    notice_count: caseNotices(c.id).length,
    filed_count: caseNotices(c.id).filter((n) => isFiled(n.status)).length,
    removed_count: db.clock.filter((e) => e.case_id === c.id && e.event === 'removed').length,
  }
}

function caseDetail(id: string): CaseDetail {
  const c = db.cases.find((x) => x.id === id)
  if (!c) throw new ApiError(404, 'No such case')
  const threats = db.threats.filter((t) => t.case_id === id).sort((a, b) => a.detected_at.localeCompare(b.detected_at))
  const ids = new Map<string, { kind: string; value: string; hosts: string[] }>()
  for (const t of threats)
    for (const i of db.identifiers.filter((x) => x.threat_id === t.id)) {
      const k = `${i.kind}:${i.value}`
      const cur = ids.get(k) ?? { kind: i.kind, value: i.value, hosts: [] }
      cur.hosts.push(t.hostname)
      ids.set(k, cur)
    }
  const refs = new Set([id, ...threats.map((t) => t.id), ...caseNotices(id).map((n) => n.id)])
  return {
    ...caseSummary(c), threats,
    identifiers: [...ids.values()].map((i) => ({ kind: i.kind, value: i.value, hosts: i.hosts.join(' | '), n: i.hosts.length })).sort((a, b) => b.n - a.n),
    notices: caseNotices(id).sort((a, b) => a.drafted_at.localeCompare(b.drafted_at)),
    clock: db.clock.filter((e) => e.case_id === id),
    audit: db.audit.filter((a) => a.ref && refs.has(a.ref)).sort((a, b) => a.ts.localeCompare(b.ts)),
  }
}

function stats(): Stats {
  const by: Record<string, number> = {}
  for (const t of db.threats) by[t.confidence ?? 'pending'] = (by[t.confidence ?? 'pending'] ?? 0) + 1
  const count = (s: NoticeStatus) => db.notices.filter((n) => n.status === s).length
  return {
    counts: {
      threats: db.threats.length, by_confidence: by, open_cases: db.cases.filter((c) => c.status === 'open').length,
      notices_drafted: db.notices.length, notices_awaiting_approval: count('drafted'), notices_filed: count('filed_dry_run') + count('filed'),
    },
    ct: { ...ctSnapshot(), rate_now: rate },
    queue: db.threats.filter((t) => t.status === 'queued').length,
    dry_run: true,
  }
}

const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return Math.round((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) * 10) / 10
}

function report(month: string): Report {
  // Demo data is seeded relative to "now", so the report covers all of it whatever month is selected.
  const events = db.clock
  const firstDetected = (caseId: string) => caseSummary(db.cases.find((c) => c.id === caseId)!).first_detected
  const filedAt = new Map(events.filter((e) => e.event === 'filed').map((e) => [e.notice_id, e.ts]))
  const per = new Map<string, { filed: number; first_response: number; removed: number; d2r: number[]; f2r: number[] }>()
  for (const e of events) {
    const ch = per.get(e.channel ?? 'case') ?? { filed: 0, first_response: 0, removed: 0, d2r: [], f2r: [] }
    if (e.event === 'filed' || e.event === 'first_response' || e.event === 'removed') ch[e.event] += 1
    if (e.event === 'removed') {
      ch.d2r.push((Date.parse(e.ts) - Date.parse(firstDetected(e.case_id))) / 60_000)
      const f = filedAt.get(e.notice_id)
      if (f) ch.f2r.push((Date.parse(e.ts) - Date.parse(f)) / 60_000)
    }
    per.set(e.channel ?? 'case', ch)
  }
  const by: Record<string, number> = {}
  for (const t of db.threats) by[t.confidence ?? 'pending'] = (by[t.confidence ?? 'pending'] ?? 0) + 1
  return {
    brand: BRAND.display_name, month, generated_at: iso(Date.now()), dry_run: true,
    limitations: [
      'Dry run: no notice was sent to any recipient.',
      'Responses and removals are logged by an operator and marked simulated.',
      'Detection covers Certificate Transparency logs and manual submissions only.',
      'Sample data: this report is generated from the built-in demo dataset.',
    ],
    threats_detected: db.threats.length, threats_by_confidence: by, cases_opened: db.cases.length,
    notices: Object.fromEntries(LIVE_STATUSES.map((s) => [s, db.notices.filter((n) => n.status === s).length])) as Report['notices'],
    channels: [...per.entries()].sort().map(([channel, c]) => ({
      channel, filed: c.filed, first_response: c.first_response, removed: c.removed,
      median_detect_to_removed_min: median(c.d2r), median_file_to_removed_min: median(c.f2r),
    })),
    cases: db.cases.map((c) => {
      const s = caseSummary(c)
      return { id: c.id, opened_at: c.opened_at, threats: s.threat_count, filed: s.filed_count, removed: s.removed_count, status: c.status }
    }),
  }
}

// ---- the simulated pipeline (hit -> capture -> score -> case -> notices) -----------

const FIXTURES: Record<string, { host: string; title: string; phone: string | null; wallet: string | null; telegram: string | null; text: string; officialFavicon: boolean; confidence: 'high' | 'low' }> = {
  clone: {
    host: 'nkwaex-support.com', title: 'Nkwa Exchange Customer Support Desk', phone: '0240000101', wallet: 'TNkwaExDemoFakeWa11etDoNotUse12345', telegram: 'nkwa_support_gh',
    text: 'Nkwa Exchange Customer Support Desk. Double your USDT. Guaranteed returns. Send your deposit to activate your account. Pay via MoMo 024 000 0101.', officialFavicon: true, confidence: 'high',
  },
  clone2: {
    host: 'nkwaex-airdrop.top', title: 'NKWA EXCHANGE AIRDROP 2026', phone: '0240000101', wallet: null, telegram: null,
    text: 'Nkwa Exchange airdrop. Limited time bonus. Send a small activation deposit to claim 500 USDT. Pay via MoMo 024 000 0101.', officialFavicon: true, confidence: 'high',
  },
  decoy: {
    host: 'nkwafarms.com', title: 'Nkwa Farms | Fresh produce, Kumasi', phone: null, wallet: null, telegram: null,
    text: 'Nkwa Farms. Fresh produce delivered in Kumasi. Order tomatoes, plantain and yam. Call 0322000111.', officialFavicon: false, confidence: 'low',
  },
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function startPipeline(t: Threat, fixtureKey: string | null) {
  emit({ type: 'hit', threat_id: t.id, host: t.hostname, priority: t.stage_a?.priority ?? 50, reasons: t.stage_a?.reasons ?? [], source: t.source })
  setTimeout(() => emit({ type: 'capturing', threat_id: t.id, host: t.hostname }), 900)
  setTimeout(() => finishPipeline(t.id, fixtureKey), 2800)
}

function finishPipeline(threatId: string, fixtureKey: string | null) {
  const t = db.threats.find((x) => x.id === threatId)
  if (!t || t.status !== 'queued') return
  const fx = fixtureKey ? FIXTURES[fixtureKey] : null
  const host = t.hostname
  const looksBrand = /nkwa/.test(host)
  const at = iso(Date.now())
  const high = fx ? fx.confidence === 'high' : looksBrand
  const phones = fx?.phone ? [fx.phone] : []
  const wallets = fx?.wallet ? [fx.wallet] : []

  t.capture = mkCapture(host, {
    title: fx?.title ?? (looksBrand ? 'Nkwa Exchange' : host), text: fx?.text ?? (looksBrand ? 'Nkwa Exchange. Verify your account.' : 'Welcome.'),
    phones, wallets, telegram: fx?.telegram ? [fx.telegram] : [], officialFavicon: fx?.officialFavicon ?? false, at,
  })
  t.title = t.capture.title
  t.screenshot_ref = t.capture.screenshot_ref
  const evidence: Record<string, unknown> = {}
  const seed = "nkwaexchange"
  if (looksBrand) evidence.brand_name_in_domain = `hostname ${host} vs seed '${seed}'`
  if (high) {
    evidence.brand_plus_lure_word = `hostname ${host} vs seed 'nkwaex'`
    evidence.brand_named_on_page = "page text contains 'nkwa exchange'"
    if (fx?.officialFavicon) evidence.logo_or_favicon_match = 'favicon mmh3 834202372 equals an official favicon'
    if (phones.length || wallets.length) evidence.payment_identifier_not_official = { phones, wallets }
    evidence.lure_language_on_page = ['double your', 'guaranteed returns']
  } else if (fx) {
    evidence.brand_named_on_page = "page text contains 'nkwa'"
  }
  t.verdict = mkVerdict(high ? 'high' : looksBrand && !fx ? 'medium' : 'low', high ? 100 : looksBrand && !fx ? 55 : 0, evidence)
  t.verdict.rules_version = RULES_VERSION
  t.confidence = t.verdict.confidence
  t.score = t.verdict.score
  t.enrichment = high || looksBrand
    ? mkEnrichment(host, { registrar: 'Namecheap, Inc.', abuse: 'abuse@namecheap.com', created: hoursAgo(30), network: 'Cloudflare, Inc.', ip: '104.21.' + (10 + (host.length % 80)) + '.' + (20 + (host.length % 200)), hostAbuse: 'abuse@cloudflare.com' })
    : { host, registered_domain: host, free_host_platform: null, ips: [] }
  t.status = 'scored'
  t.updated_at = at
  db.audit.push({ ts: at, actor: 'system', action: 'threat_scored', ref: t.id, detail: { confidence: t.confidence } })

  const result: Extract<LiveEvent, { type: 'scored' }> = {
    type: 'scored', threat_id: t.id, host, confidence: t.confidence!, score: t.score!, reasons: t.verdict.reason_codes,
  }
  if (t.confidence === 'high' || t.confidence === 'medium') {
    for (const p of phones) db.identifiers.push({ threat_id: t.id, kind: 'phone', value: p })
    for (const w of wallets) db.identifiers.push({ threat_id: t.id, kind: 'wallet', value: w })
    if (fx?.telegram) db.identifiers.push({ threat_id: t.id, kind: 'telegram', value: fx.telegram })
    // Campaign linking: only a shared phone, wallet or telegram handle joins an open case.
    const mine = db.identifiers.filter((i) => i.threat_id === t.id)
    const hit = db.identifiers.find((i) => i.threat_id !== t.id && mine.some((m) => m.kind === i.kind && m.value === i.value) &&
      db.threats.find((x) => x.id === i.threat_id)?.case_id && db.cases.find((c) => c.id === db.threats.find((x) => x.id === i.threat_id)!.case_id)?.status === 'open')
    let caseId: string
    const linkedVia: string[] = []
    if (hit) {
      caseId = db.threats.find((x) => x.id === hit.threat_id)!.case_id!
      for (const m of mine) if (db.identifiers.some((i) => i.threat_id !== t.id && i.kind === m.kind && i.value === m.value)) linkedVia.push(`${m.kind}:${m.value}`)
      db.audit.push({ ts: at, actor: 'system', action: 'threat_linked_to_case', ref: t.id, detail: { case_id: caseId } })
    } else {
      caseId = rid('case')
      db.cases.push({ id: caseId, opened_at: at, status: 'open', title: 'Suspected clone of Nkwa Exchange' })
      db.audit.push({ ts: at, actor: 'system', action: 'case_opened', ref: caseId, detail: { first_threat: t.id } })
    }
    t.case_id = caseId
    const existing = new Set(caseNotices(caseId).map((n) => `${n.channel}|${n.subject}`))
    let drafted = 0
    for (const d of draftNotices(t, caseId)) {
      if (d.channel.startsWith('telco_') && existing.has(`${d.channel}|${d.subject}`)) continue // one fraud-desk report per number per case
      const n = mkNotice(t, caseId, d, { drafted_at: at })
      db.notices.push(n)
      db.audit.push({ ts: at, actor: 'system', action: 'notice_drafted', ref: n.id, detail: { channel: n.channel, threat_id: t.id } })
      drafted++
    }
    Object.assign(result, { case_id: caseId, linked_via: linkedVia, notices_drafted: drafted })
  }
  save()
  emit(result)
}

function queueThreat(host: string, url: string | null, source: string, fixtureKey: string | null): Threat {
  const at = iso(Date.now())
  const looksBrand = /nkwa/.test(host)
  const t: Threat = {
    id: rid('thr'), brand_id: BRAND_ID, hostname: host, url, source, source_ref: null, detected_at: at,
    stage_a: { reasons: looksBrand ? ['brand_name_in_domain'] : [], priority: looksBrand ? 55 : 0, seed: 'nkwaexchange' },
    status: 'queued', capture: null, verdict: null, enrichment: null, confidence: null, score: null, case_id: null, updated_at: at,
  }
  db.threats.push(t)
  db.audit.push({ ts: at, actor: 'system', action: 'threat_detected', ref: t.id, detail: null })
  save()
  startPipeline(t, fixtureKey)
  return t
}

// Anything left queued by a refresh mid-pipeline is finished straight away.
for (const t of db.threats.filter((x) => x.status === 'queued')) finishPipeline(t.id, null)

// ---- request handling -----------------------------------------------------------

/** Sample takedown detection: a site counts as taken down once a removal was logged against any notice about it. */
function liveness(caseId: string) {
  return db.threats.filter((t) => t.case_id === caseId && db.notices.some((n) => n.threat_id === t.id && isFiled(n.status))).map((t) => {
    const gone = db.clock.some((e) => e.event === 'removed' && db.notices.find((n) => n.id === e.notice_id)?.threat_id === t.id)
    return { threat_id: t.id, hostname: t.hostname, status: gone ? 'gone' : 'live', reason: gone ? 'the page returns HTTP 404' : 'HTTP 200', checked_at: iso(Date.now()) }
  })
}

const need = <T,>(v: T | undefined | null, msg: string, status = 404): T => {
  if (v == null) throw new ApiError(status, msg)
  return v
}
const delay = () => new Promise((r) => setTimeout(r, 120 + Math.random() * 160))

function noticeOrThrow(id: string): Notice {
  return need(db.notices.find((n) => n.id === id), 'No such notice')
}

export async function handleMock(path: string, init?: RequestInit): Promise<any> {
  await delay()
  const url = new URL(path, 'http://demo.local')
  const method = (init?.method ?? 'GET').toUpperCase()
  const body = init?.body ? JSON.parse(String(init.body)) : {}
  const p = url.pathname.replace(/^\/api/, '')
  const seg = p.split('/').filter(Boolean)
  const now = iso(Date.now())

  // Signed-in demo session (sample data has no real sign-in)
  if (seg[0] === 'auth') return seg[1] === 'logout' ? { ok: true } : { email: 'demo@haul16.test', name: 'Demo user', auth_enabled: true }

  if (seg[0] === 'brands') {
    const forBrand = seg[1] === BRAND_ID
    const counts = { threats: forBrand ? db.threats.length : 0, awaiting: forBrand ? db.notices.filter((n) => n.status === 'drafted').length : 0, approved: forBrand ? db.notices.filter((n) => n.status === 'approved').length : 0 }
    return handleBrandRoute(db.brandState!, method, seg, body, save, counts)
  }

  // Sample takedown data exists only for the demo brand. Any other brand starts empty, like a real new brand.
  const scoped = ((init?.headers ?? {}) as Record<string, string>)['x-brand-id']
  if (scoped && scoped !== BRAND_ID) {
    if (method === 'GET') {
      if (p === '/stats') return { ...stats(), counts: { threats: 0, by_confidence: {}, open_cases: 0, notices_drafted: 0, notices_awaiting_approval: 0, notices_filed: 0 }, queue: 0 }
      if (['/threats', '/cases', '/notices', '/audit'].includes(p)) return []
      if (p === '/report') return { ...report(url.searchParams.get('month') ?? now.slice(0, 7)), threats_detected: 0, threats_by_confidence: {}, cases_opened: 0, notices: { drafted: 0, approved: 0, filed_dry_run: 0, rejected: 0 }, channels: [], cases: [] }
    }
    if (method === 'POST' && (p === '/inject' || p === '/demo/clone')) throw new ApiError(409, 'Sample data only runs for the demo brand. Switch to it from the account menu.')
  }

  if (seg[0] === 'sources' && method === 'PUT') {
    const off = new Set(db.sourceOff ?? [])
    if (body.enabled) off.delete(seg[1]); else off.add(seg[1])
    db.sourceOff = [...off]
    save()
    const s = SOURCES.find((x) => x[0] === seg[1])
    if (!s) throw new ApiError(404, 'No such source')
    return { id: s[0], label: s[1], description: s[2], needs_key: s[3], configured: !s[3], enabled: body.enabled }
  }

  if (method === 'GET') {
    if (p === '/health') return { ok: true, dry_run: true, email_ready: false, ct_enabled: true, demo: true, alert_channels: { webhook: false, email: false }, collectors: {} }
    if (p === '/alerts') {
      const items = scoped && scoped !== BRAND_ID ? [] : [...(db.alerts ?? [])].sort((a, b) => b.id - a.id)
      return { unread: items.filter((a) => !a.read_at).length, items }
    }
    if (p === '/sources') return SOURCES.map(([id, label, description, key]) => ({ id, label, description, needs_key: key, configured: !key, enabled: !(db.sourceOff ?? []).includes(id) }))
    if (seg[0] === 'cases' && seg[2] === 'liveness') return liveness(seg[1])
    if (p === '/brand') return BRAND
    if (p === '/stats') return stats()
    if (p === '/threats') {
      const conf = url.searchParams.get('confidence')
      return db.threats
        .filter((t) => !conf || t.confidence === conf)
        .sort((a, b) => b.detected_at.localeCompare(a.detected_at))
        .map(({ capture, enrichment: _e, ...t }) => ({ ...t, title: capture?.title ?? null, screenshot_ref: capture?.screenshot_ref ?? null }))
    }
    if (seg[0] === 'threats' && seg[1]) return need(db.threats.find((t) => t.id === seg[1]), 'No such threat')
    if (p === '/cases') return db.cases.map(caseSummary).sort((a, b) => b.opened_at.localeCompare(a.opened_at))
    if (seg[0] === 'cases' && seg[1]) return caseDetail(seg[1])
    if (p === '/notices') {
      const status = url.searchParams.get('status')
      if (status && !LIVE_STATUSES.includes(status as NoticeStatus)) throw new ApiError(422, 'Unknown notice status')
      return db.notices
        .filter((n) => !status || n.status === status)
        .map((n) => ({ ...n, case_title: db.cases.find((c) => c.id === n.case_id)?.title ?? '', host: db.threats.find((t) => t.id === n.threat_id)?.hostname ?? null }))
        .sort((a, b) => b.drafted_at.localeCompare(a.drafted_at))
    }
    if (p === '/report') return report(url.searchParams.get('month') ?? now.slice(0, 7))
    if (p === '/audit') return [...db.audit].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 100)
  }

  if (method === 'POST') {
    if (seg[0] === 'cases' && seg[2] === 'redraft') {
      const c = need(db.cases.find((x) => x.id === seg[1]), 'No such case')
      let n = 0
      for (const t of db.threats.filter((x) => x.case_id === c.id))
        for (const d of draftNotices(t, c.id))
          if (!db.notices.some((x) => x.threat_id === t.id && x.channel === d.channel)) {
            const nt = mkNotice(t, c.id, d, { drafted_at: now })
            db.notices.push(nt)
            db.audit.push({ ts: now, actor: 'system', action: 'notice_drafted', ref: nt.id, detail: { channel: d.channel, threat_id: t.id } })
            n++
          }
      save()
      return { drafted: n }
    }
    if (seg[0] === 'notices' && seg[1] && seg[2]) {
      const n = noticeOrThrow(seg[1])
      if (seg[2] === 'approve') {
        const who = String(body.approver ?? '').trim()
        if (who.length < 2) throw new ApiError(422, 'String should have at least 2 characters')
        if (n.status !== 'drafted') throw new ApiError(409, `Notice is ${n.status}, only drafts can be approved`)
        Object.assign(n, { status: 'approved', approved_by: who, approved_at: now })
        db.audit.push({ ts: now, actor: who, action: 'notice_approved', ref: n.id, detail: null })
      } else if (seg[2] === 'reject') {
        const who = String(body.approver ?? '').trim()
        if (who.length < 2) throw new ApiError(422, 'String should have at least 2 characters')
        if (String(body.reason ?? '').trim().length < 3) throw new ApiError(422, 'String should have at least 3 characters')
        if (n.status !== 'drafted' && n.status !== 'approved') throw new ApiError(409, `Notice is ${n.status}, it can no longer be rejected`)
        Object.assign(n, { status: 'rejected', approved_by: who, approved_at: now })
        db.audit.push({ ts: now, actor: who, action: 'notice_rejected', ref: n.id, detail: { reason: body.reason } })
      } else if (seg[2] === 'file') {
        if (n.status !== 'approved') throw new ApiError(409, 'A person must approve this notice before it is filed')
        const mode = String(body.mode ?? 'dry_run')
        if (mode === 'email') throw new ApiError(409, 'Sending is switched off (dry run). Set HAUL16_DRY_RUN=0 on the server to send for real, or file it by hand.')
        const real = mode === 'manual'
        Object.assign(n, { status: real ? 'filed' : 'filed_dry_run', filed_at: now })
        db.clock.push({ id: db.clockSeq++, case_id: n.case_id, notice_id: n.id, channel: n.channel, event: 'filed', ts: now, simulated: real ? 0 : 1, note: real ? (body.reference || 'Filed by hand by a person.') : null })
        db.audit.push({ ts: now, actor: n.approved_by ?? 'operator', action: real ? 'notice_filed' : 'notice_filed_dry_run', ref: n.id, detail: { mode } })
        save()
        emit({ type: 'filed', notice_id: n.id, case_id: n.case_id, channel: n.channel })
        return n
      } else if (seg[2] === 'clock') {
        if (!isFiled(n.status)) throw new ApiError(409, 'File the notice before logging a response')
        if (body.event !== 'first_response' && body.event !== 'removed') throw new ApiError(422, 'String should match pattern')
        db.clock.push({ id: db.clockSeq++, case_id: n.case_id, notice_id: n.id, channel: n.channel, event: body.event, ts: now, simulated: n.status === 'filed_dry_run' ? 1 : 0, note: body.note ?? null })
        db.audit.push({ ts: now, actor: 'operator', action: `clock_${body.event}`, ref: n.id, detail: null })
        save()
        return db.clock.filter((e) => e.case_id === n.case_id)
      }
      save()
      return n
    }
    if (p === '/inject') {
      const raw = String(body.url ?? '')
      if (!/^https?:\/\//.test(raw)) throw new ApiError(422, 'String should match pattern ^https?://')
      const host = String(body.as_host || hostOf(raw)).toLowerCase()
      const dup = db.threats.find((t) => t.hostname === host)
      if (dup) return { threat_id: null, duplicate: true }
      return { threat_id: queueThreat(host, raw, 'manual', null).id, duplicate: false }
    }
    if (p === '/demo/clone') {
      const fx = need(FIXTURES[String(body.variant)], 'Unknown variant', 422)
      const dup = db.threats.find((t) => t.hostname === fx.host)
      if (dup) return { threat_id: dup.id, duplicate: true, host: fx.host }
      return { threat_id: queueThreat(fx.host, `http://127.0.0.1:8000/demo-sites/${body.variant}/`, 'demo_fixture', String(body.variant)).id, duplicate: false, host: fx.host }
    }
    if (p === '/alerts/read') {
      const ids: number[] | null = body.ids ?? null
      for (const a of db.alerts ?? []) if (!a.read_at && (!ids || ids.includes(a.id))) a.read_at = now
      save()
      return { marked: 0, unread: (db.alerts ?? []).filter((a) => !a.read_at).length }
    }
    if (p === '/alerts/test') {
      const a = { id: Math.max(0, ...(db.alerts ?? []).map((x) => x.id)) + 1, brand_id: BRAND_ID, kind: 'test', severity: 'high' as const, title: 'Test alert from HAUL16', detail: 'If you can read this, this channel works.', href: '/home', created_at: now, read_at: null, delivered: {} }
      ;(db.alerts ??= []).push(a)
      save()
      return { id: a.id, delivered: {}, channels: { webhook: false, email: false } }
    }
    if (p === '/demo/reset') {
      db = { ...makeSeed(), brandState: seedBrandState(), alerts: seedAlerts() }
      save()
      return { ok: true }
    }
  }
  throw new ApiError(404, `Not found: ${method} ${p}`)
}

