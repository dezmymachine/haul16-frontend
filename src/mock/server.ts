// An in-browser stand-in for the HAUL16 FastAPI backend, used when no backend is reachable (for example a static
// Vercel deploy). It implements every route the UI calls, keeps state in memory (mirrored to localStorage so a
// refresh does not lose a demo in progress), and emits the same live events as the real /api/events stream.
import {
  ApiError, type CaseDetail, type CaseDossier, type CaseDossierThreat, type CaseSummary, type Notice,
  type NoticeStatus, type Report, type Stats, type Threat,
} from '@/api'
import type { LiveEvent } from '@/live'
import {
  BRAND, BRAND_ID, RULES_VERSION, draftNotices, hoursAgo, iso, makeSeed, mkCapture, mkEnrichment, mkNotice, mkVerdict, rid,
  type DB,
} from './data'

const STORE_KEY = 'haul16.demo.v1'
const LIVE_STATUSES: NoticeStatus[] = ['drafted', 'approved', 'filed_dry_run', 'rejected']

function load(): DB {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw) as DB
  } catch {
    /* storage blocked or corrupt: start from the seed */
  }
  return makeSeed()
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
    filed_count: caseNotices(c.id).filter((n) => n.status === 'filed_dry_run').length,
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

function caseDossier(id: string): CaseDossier {
  const c = caseDetail(id)
  const threats: CaseDossierThreat[] = c.threats.map((t) => ({
    threat_id: t.id,
    hostname: t.hostname,
    url: t.capture?.final_url ?? t.url ?? `https://${t.hostname}/`,
    detected_at: t.detected_at,
    captured_at: t.capture?.captured_at ?? null,
    confidence: t.confidence,
    score: t.score,
    reason_codes: t.verdict?.reason_codes ?? [],
    evidence: t.verdict?.evidence ?? {},
    hashes: {
      html_sha256: t.capture?.html_sha256 ?? null,
      screenshot_sha256: t.capture?.screenshot_sha256 ?? null,
      screenshot_ref: t.capture?.screenshot_ref ?? null,
      favicon_mmh3: t.capture?.favicon_mmh3 ?? null,
      favicon_sha256: null,
    },
    attribution: {
      registered_domain: t.enrichment?.registered_domain ?? null,
      registrar: t.enrichment?.registration?.registrar ?? null,
      registrar_abuse_email: t.enrichment?.registration?.registrar_abuse_email ?? null,
      hosting_network: t.enrichment?.hosting?.network ?? null,
      host_abuse_email: t.enrichment?.hosting?.host_abuse_email ?? null,
      ips: t.enrichment?.ips ?? [],
    },
  }))

  return {
    dossier_id: `HAUL16-DOSSIER-${id.toUpperCase()}`,
    generated_at: iso(Date.now()),
    rules_version: RULES_VERSION,
    manifest_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    legal_basis: {
      jurisdiction: 'Ghana',
      statutes: [
        'Electronic Transactions Act, 2008 (Act 772), Sections 90-95 (Intermediary Takedown & Liability Protections)',
        'Data Protection Act, 2012 (Act 843) (Personal Data Processing for Fraud Prevention)',
        'Securities Industry Act, 2016 (Act 929) & SEC Digital Asset Framework',
      ],
      designated_agent: {
        entity: 'HAUL16 Brand Abuse Desk',
        brand_id: BRAND_ID,
        brand_name: BRAND.display_name,
        official_domains: BRAND.official_domains,
        authorisation_letter_ref: BRAND.authorisation_letter.ref,
        authorisation_letter_sha256: BRAND.authorisation_letter.sha256,
      },
    },
    case: {
      id: c.id,
      title: c.title,
      status: c.status,
      opened_at: c.opened_at,
      first_detected: c.first_detected,
    },
    campaign_linkage: {
      linking_kinds_enforced: ['phone', 'wallet', 'telegram'],
      shared_identifiers: c.identifiers,
      explanation: 'Threats are clustered into this campaign strictly by shared unverified payment numbers, crypto wallets, or direct contact handles.',
    },
    threats,
    notices: c.notices,
    clock_events: c.clock,
    chain_of_custody: c.audit,
    limitations: [
      'All filings in this desk are recorded as dry-run simulations until formal transmission.',
      'Takedown clocks and removal times are calculated from initial detection to verified removal.',
      'Attribution data is gathered via public RFC 9083 RDAP queries and direct DNS resolution.',
    ],
  }
}

function stats(): Stats {
  const by: Record<string, number> = {}
  for (const t of db.threats) by[t.confidence ?? 'pending'] = (by[t.confidence ?? 'pending'] ?? 0) + 1
  const count = (s: NoticeStatus) => db.notices.filter((n) => n.status === s).length
  return {
    counts: {
      threats: db.threats.length, by_confidence: by, open_cases: db.cases.filter((c) => c.status === 'open').length,
      notices_drafted: db.notices.length, notices_awaiting_approval: count('drafted'), notices_filed: count('filed_dry_run'),
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
    host: 'yellowcard-staging.com', title: 'Yellow Card Customer Support Desk', phone: '0245550142', wallet: 'TYellowCardFakeWa11etDoNotUse12345', telegram: 'yellowcard_support_gh',
    text: 'Yellow Card Ghana Customer Support Desk. Instant crypto buy & cashout. Send verification deposit to MoMo 024 555 0142. VIP Signal Telegram @yellowcard_support_gh.', officialFavicon: true, confidence: 'high',
  },
  clone2: {
    host: 'yellowcard-gh.top', title: 'YELLOW CARD GHANA AIRDROP 2026', phone: '0245550142', wallet: null, telegram: null,
    text: 'Yellow Card Ghana airdrop. Limited time bonus. Send a small activation deposit to claim 500 USDT. Pay via MoMo 024 555 0142.', officialFavicon: true, confidence: 'high',
  },
  decoy: {
    host: 'yellowfarms.com', title: 'Yellow Farms | Fresh produce, Kumasi', phone: null, wallet: null, telegram: null,
    text: 'Yellow Farms. Fresh produce delivered in Kumasi. Order tomatoes, plantain and yam. Call 0322000111.', officialFavicon: false, confidence: 'low',
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
  const looksBrand = /yellowcard|yellow-card|nkwa/.test(host)
  const at = iso(Date.now())
  const high = fx ? fx.confidence === 'high' : looksBrand
  const phones = fx?.phone ? [fx.phone] : []
  const wallets = fx?.wallet ? [fx.wallet] : []

  t.capture = mkCapture(host, {
    title: fx?.title ?? (looksBrand ? 'Yellow Card' : host), text: fx?.text ?? (looksBrand ? 'Yellow Card. Verify your account.' : 'Welcome.'),
    phones, wallets, telegram: fx?.telegram ? [fx.telegram] : [], officialFavicon: fx?.officialFavicon ?? false, at,
  })
  t.title = t.capture.title
  t.screenshot_ref = t.capture.screenshot_ref
  const evidence: Record<string, unknown> = {}
  const seed = "yellowcard"
  if (looksBrand) evidence.brand_name_in_domain = `hostname ${host} vs seed '${seed}'`
  if (high) {
    evidence.brand_plus_lure_word = `hostname ${host} vs seed 'yellowcard'`
    evidence.brand_named_on_page = "page text contains 'yellow card'"
    if (fx?.officialFavicon) evidence.logo_or_favicon_match = 'favicon mmh3 -373997759 equals an official favicon'
    if (phones.length || wallets.length) evidence.payment_identifier_not_official = { phones, wallets }
    evidence.lure_language_on_page = ['double your', 'guaranteed returns']
  } else if (fx) {
    evidence.brand_named_on_page = "page text contains 'yellow card'"
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
      db.cases.push({ id: caseId, opened_at: at, status: 'open', title: 'Suspected clone of Yellow Card' })
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

  if (method === 'GET') {
    if (p === '/health') return { ok: true, dry_run: true, ct_enabled: true, demo: true }
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
    if (seg[0] === 'cases' && seg[1]) return seg[2] === 'dossier' ? caseDossier(seg[1]) : caseDetail(seg[1])
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
        Object.assign(n, { status: 'filed_dry_run', filed_at: now })
        db.clock.push({ id: db.clockSeq++, case_id: n.case_id, notice_id: n.id, channel: n.channel, event: 'filed', ts: now, simulated: 1, note: null })
        db.audit.push({ ts: now, actor: n.approved_by ?? 'operator', action: 'notice_filed_dry_run', ref: n.id, detail: null })
        save()
        emit({ type: 'filed', notice_id: n.id, case_id: n.case_id, channel: n.channel })
        return n
      } else if (seg[2] === 'clock') {
        if (n.status !== 'filed_dry_run') throw new ApiError(409, 'File the notice before logging a response')
        if (body.event !== 'first_response' && body.event !== 'removed') throw new ApiError(422, 'String should match pattern')
        db.clock.push({ id: db.clockSeq++, case_id: n.case_id, notice_id: n.id, channel: n.channel, event: body.event, ts: now, simulated: 1, note: body.note ?? null })
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
    if (p === '/threats/ingest-real') {
      const targets = ['yellowcard-staging.com', 'yellowcard.cc', 'yellowcard-apparel.shop']
      const results = targets.map((host) => {
        const existing = db.threats.find((t) => t.hostname === host)
        if (existing) return { host, threat_id: existing.id, status: 'already_tracked' }
        const t = queueThreat(host, `https://${host}`, 'certificate_transparency', null)
        return { host, threat_id: t.id, status: 'processed', verdict: 'medium', score: 65, case_id: 'case_4be07d92a1' }
      })
      save()
      return { ingested_count: results.length, targets, results }
    }
    if (p === '/demo/clone') {
      const fx = need(FIXTURES[String(body.variant)], 'Unknown variant', 422)
      const dup = db.threats.find((t) => t.hostname === fx.host)
      if (dup) return { threat_id: dup.id, duplicate: true, host: fx.host }
      return { threat_id: queueThreat(fx.host, `http://127.0.0.1:8000/demo-sites/${body.variant}/`, 'demo_fixture', String(body.variant)).id, duplicate: false, host: fx.host }
    }
    if (p === '/demo/reset') {
      db = makeSeed()
      save()
      return { ok: true }
    }
    if (p === '/demo/seed') {
      db = makeSeed()
      save()
      return { ok: true, threats: db.threats.length, cases: db.cases.length }
    }
  }
  throw new ApiError(404, `Not found: ${method} ${p}`)
}

