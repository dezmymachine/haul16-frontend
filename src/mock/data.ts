// Seed data and builders for the in-browser demo backend. All brands, sites, numbers and wallets are fictional.
import type {
  AuditRow, BrandRegister, Capture, ClockEvent, Confidence, Enrichment, Notice, Threat, Verdict,
} from '@/api'

export interface MockCase { id: string; opened_at: string; status: string; title: string }
export interface MockIdentifier { threat_id: string; kind: string; value: string }
export interface DB {
  threats: Threat[]
  cases: MockCase[]
  identifiers: MockIdentifier[]
  notices: Notice[]
  clock: ClockEvent[]
  audit: AuditRow[]
  clockSeq: number
}

export const BRAND: BrandRegister = {
  brand_id: 'yellowcard_gh',
  display_name: 'Yellow Card',
  fictional: false,
  seed_terms: ['yellowcard', 'yellow-card', 'nkwaex', 'nkwaexchange'],
  official_domains: ['yellowcard.io', 'nkwaex.com'],
  official_handles: { x: '@yellowcard_app', linkedin: 'company/yellowcardapp', telegram: '@YellowCardApp', instagram: '@yellowcard_app' },
  official_numbers: ['+233596993041', '+233501691234', '0302000000'],
  official_wallets: [],
  official_favicon_mmh3: [-373997759, 834202372],
  allowlist_domains: ['yellowcard.app', 'yellowcard.academy'],
  authorisation_letter: {
    ref: 'fixtures/authorisation_letter_yellowcard.txt',
    sha256: '1d5e2fe794fafce23400851d6752b52ca9ee9c299e3866c220d46f35e7041fdb',
  },
}
export const BRAND_ID = BRAND.brand_id
export const RULES_VERSION = '2026-10-30.1'

// ---- small helpers -------------------------------------------------------

export const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, '+00:00')
export const hoursAgo = (h: number) => iso(Date.now() - h * 3_600_000)
export const rid = (prefix: string) => `${prefix}_${Math.random().toString(16).slice(2, 12).padEnd(10, '0')}`

/** Deterministic 64-hex digest-looking string (display only, not cryptographic). */
export function fakeHash(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  let out = ''
  let a = h1, b = h2
  while (out.length < 64) {
    a = Math.imul(a ^ (a >>> 15), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909)
    b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909)
    out += (a >>> 0).toString(16).padStart(8, '0')
  }
  return out.slice(0, 64)
}

export const TELCO_PREFIX: Record<string, string[]> = {
  mtn: ['024', '025', '053', '054', '055', '059'],
  telecel: ['020', '050'],
  at: ['026', '027', '056', '057'],
}
export const telcoOf = (phone: string) =>
  (Object.entries(TELCO_PREFIX).find(([, p]) => p.some((x) => phone.startsWith(x))) ?? [null])[0] as 'mtn' | 'telecel' | 'at' | null

// ---- evidence-backed claim sentences (mirrors backend CLAIM_TEXT) ----------

const CLAIM: Record<string, (v: string) => string> = {
  logo_or_favicon_match: (v) => `The page uses the same site icon as Yellow Card's official site (${v}).`,
  payment_identifier_not_official: (v) => `The page asks for payment to identifiers Yellow Card has not registered: ${v}.`,
  brand_named_on_page: (v) => `The page presents itself as Yellow Card (${v}).`,
  lure_language_on_page: (v) => `The page uses investment-lure wording: ${v}.`,
  homoglyph_of_brand: (v) => `The hostname imitates Yellow Card's name using look-alike characters (${v}).`,
  typo_of_brand: (v) => `The hostname is a misspelling of Yellow Card's name (${v}).`,
  brand_name_exact_label: (v) => `The hostname uses Yellow Card's name on a domain Yellow Card does not own (${v}).`,
  brand_name_in_domain: (v) => `The hostname contains Yellow Card's name (${v}).`,
  brand_plus_lure_word: (v) => `The hostname pairs Yellow Card's name with a lure word (${v}).`,
}

export function showEvidence(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'object')
    return Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => (Array.isArray(x) ? x.length : x))
      .map(([k, x]) => `${k}: ${showEvidence(x)}`)
      .join(' · ')
  return String(v)
}

export function claimLines(verdict: Verdict | null | undefined): string[] {
  if (!verdict) return []
  return verdict.reason_codes.filter((c) => CLAIM[c]).map((c) => CLAIM[c](showEvidence(verdict.evidence[c])))
}

// ---- builders --------------------------------------------------------------

export interface CaptureOpts {
  title: string | null
  text: string
  phones?: string[]
  wallets?: string[]
  telegram?: string[]
  officialFavicon?: boolean
  errors?: string[]
  at: string
  server?: string
}

export function mkCapture(host: string, o: CaptureOpts): Capture {
  const failed = !!o.errors?.length
  return {
    url: `https://${host}/`,
    final_url: failed ? null : `https://${host}/`,
    status: failed ? null : 200,
    captured_at: o.at,
    capture_tool: 'haul16-capture/0.1 (playwright-chromium)',
    title: o.title,
    html_sha256: failed ? null : fakeHash(`${host}:html`),
    screenshot_ref: failed ? null : `demo:${host}`,
    screenshot_sha256: failed ? null : fakeHash(`${host}:png`),
    favicon_url: failed ? null : `https://${host}/favicon.ico`,
    favicon_mmh3: failed ? null : o.officialFavicon ? 834202372 : -1204551872,
    server_headers: failed ? {} : { server: o.server ?? 'cloudflare' },
    text_excerpt: o.text,
    identifiers: {
      phones: o.phones ?? [],
      wallets: o.wallets?.length ? { tron: o.wallets } : {},
      telegram: o.telegram ?? [],
      whatsapp: [],
    },
    blocked_requests: [],
    errors: o.errors ?? [],
  }
}

export function mkVerdict(confidence: Confidence, score: number, evidence: Record<string, unknown>): Verdict {
  return { confidence, score, reason_codes: Object.keys(evidence).sort(), evidence, rules_version: RULES_VERSION, human_review_required: true }
}

export function mkEnrichment(host: string, o: { registrar: string; abuse: string; created: string; network: string; ip: string; hostAbuse: string; country?: string }): Enrichment {
  return {
    host,
    registered_domain: host,
    free_host_platform: null,
    ips: [o.ip],
    registration: { domain: host, registrar: o.registrar, registrar_abuse_email: o.abuse, created: o.created, rdap_status: 200 },
    hosting: { ip: o.ip, network: o.network, country: o.country ?? 'US', host_abuse_email: o.hostAbuse, rdap_status: 200 },
  }
}

// ---- notice drafting (templates only, evidence-backed, mirrors channels.yaml) ---

interface Facts {
  host: string; url: string; capturedAt: string; htmlSha: string; shotSha: string; claims: string
  phones: string; wallets: string; registrar: string; registered: string; created: string
  network: string; ip: string; caseId: string
}

function factsFor(t: Threat, caseId: string): Facts {
  const cap = t.capture, enr = t.enrichment, ev = (t.verdict?.evidence ?? {}) as Record<string, any>
  const foreign = ev.payment_identifier_not_official ?? {}
  return {
    host: t.hostname,
    url: cap?.final_url ?? cap?.url ?? `https://${t.hostname}/`,
    capturedAt: cap?.captured_at ?? 'unknown',
    htmlSha: cap?.html_sha256 ?? 'unknown',
    shotSha: cap?.screenshot_sha256 ?? 'unknown',
    claims: claimLines(t.verdict).map((c) => `- ${c}`).join('\n') || '- (no evidence-backed claims)',
    phones: (foreign.phones ?? []).join(', ') || 'none',
    wallets: (foreign.wallets ?? []).join(', ') || 'none',
    registrar: enr?.registration?.registrar ?? 'unknown',
    registered: enr?.registration?.registrar ? enr.registration.domain : 'unknown',
    created: enr?.registration?.created ?? 'unknown',
    network: enr?.hosting?.network ?? 'unknown',
    ip: enr?.ips?.[0] ?? 'unknown',
    caseId,
  }
}

const LETTER = BRAND.authorisation_letter.sha256
const HEAD = (to: string) => `To ${to},\n\nWe act as authorised agent for Yellow Card (official site: yellowcard.io). Our signed authorisation letter is attached (SHA-256 ${LETTER}).\n`
const TAIL = (f: Facts) => `\nEvidence captured ${f.capturedAt} UTC:\n- Page source SHA-256: ${f.htmlSha}\n- Screenshot SHA-256: ${f.shotSha}\n`

export interface Draft {
  channel: string; channel_name: string; method: string; recipient: string; recipient_verified: number; subject: string; body: string
}

export function draftNotices(t: Threat, caseId: string): Draft[] {
  const f = factsFor(t, caseId)
  const out: Draft[] = []
  const phones = ((t.capture?.identifiers?.phones ?? []) as string[]).filter((p) => p !== '+233596993041' && p !== '+233501691234' && p !== '0302000000')
  const hasId = phones.length > 0 || Object.keys(t.capture?.identifiers?.wallets ?? {}).length > 0
  const enr = t.enrichment

  if (enr?.registration?.registrar && enr.registration.registrar_abuse_email)
    out.push({
      channel: 'registrar', channel_name: 'Domain registrar abuse desk', method: 'email',
      recipient: enr.registration.registrar_abuse_email, recipient_verified: 1,
      subject: `Abuse report: ${f.registered} impersonating Yellow Card (case ${caseId})`,
      body: `${HEAD(`the abuse team of ${f.registrar}`)}\nThe domain ${f.registered} (created ${f.created}) hosts a page at ${f.url} that we believe impersonates Yellow Card to collect payments from the public.\n\nWhat we observed:\n${f.claims}\n${TAIL(f)}\nWe ask you to suspend the domain under your abuse policy. We can provide the full evidence pack on request.`,
    })
  if (enr?.hosting?.network && enr.hosting.host_abuse_email)
    out.push({
      channel: 'hosting', channel_name: 'Hosting provider abuse desk', method: 'email',
      recipient: enr.hosting.host_abuse_email, recipient_verified: 1,
      subject: `AUP violation: phishing page impersonating Yellow Card at ${f.host} (${f.ip})`,
      body: `${HEAD(`the abuse team of ${f.network}`)}\nA page served from ${f.ip} at ${f.url} impersonates Yellow Card.\n\nWhat we observed:\n${f.claims}\n${TAIL(f)}\nWe ask you to disable the content under your acceptable use policy.`,
    })
  out.push({
    channel: 'google_safe_browsing', channel_name: 'Google Safe Browsing', method: 'web_form',
    recipient: 'https://safebrowsing.google.com/safebrowsing/report_phish/', recipient_verified: 1,
    subject: `Phishing report: ${f.url}`,
    body: `URL: ${f.url}\nImpersonated brand: Yellow Card (yellowcard.io)\nWhy: ${f.claims}\n`,
  })
  for (const phone of phones.slice(0, 1)) {
    const tel = telcoOf(phone)
    if (tel === 'mtn')
      out.push({
        channel: 'telco_mtn', channel_name: 'MTN Ghana MoMo fraud team', method: 'email',
        recipient: 'mmfraudteam.GH@mtn.com', recipient_verified: 1,
        subject: `MoMo number used to impersonate Yellow Card: ${phone}`,
        body: `To the MTN Ghana Mobile Money fraud team,\n\nWe act as authorised agent for Yellow Card (letter SHA-256 ${LETTER}). The number ${phone} appears on a page at ${f.url} that impersonates Yellow Card and asks the public to send deposits. Yellow Card does not use this number. Its only official number is on yellowcard.io.\n\nWhat we observed:\n${f.claims}\n\nScreenshot SHA-256 ${f.shotSha}, captured ${f.capturedAt} UTC.\n\nWe ask you to investigate and, where your policy allows, block the wallet.`,
      })
    else if (tel === 'telecel' || tel === 'at')
      out.push({
        channel: tel === 'telecel' ? 'telco_telecel' : 'telco_airteltigo',
        channel_name: tel === 'telecel' ? 'Telecel Ghana fraud desk' : 'AT Ghana fraud desk', method: 'email',
        recipient: `UNVERIFIED: confirm on ${tel === 'telecel' ? 'Telecel' : 'AT'} Ghana's official site`, recipient_verified: 0,
        subject: `Number used to impersonate Yellow Card: ${phone}`,
        body: `To the fraud desk,\n\nThe number ${phone} appears on a page at ${f.url} that impersonates Yellow Card (letter SHA-256 ${LETTER}).\n\nWhat we observed:\n${f.claims}\n\nScreenshot SHA-256 ${f.shotSha}, captured ${f.capturedAt} UTC.`,
      })
  }
  if (hasId)
    out.push({
      channel: 'csa', channel_name: 'Cyber Security Authority', method: 'web_form',
      recipient: 'UNVERIFIED: CSA incident portal / 292 hotline, confirm on csa.gov.gh', recipient_verified: 0,
      subject: `Online fraud report: impersonation of Yellow Card (${caseId})`,
      body: `Incident report: online fraud impersonating Yellow Card.\n\nSite: ${f.url}\nPayment identifiers: phones ${f.phones}; wallets ${f.wallets}\n\nWhat we observed:\n${f.claims}\n${TAIL(f)}\nAuthorisation letter SHA-256 ${LETTER}.`,
    })
  const telegrams = ((t.capture?.identifiers?.telegram ?? []) as string[]).filter((tg) => tg.toLowerCase() !== 'yellowcardapp' && tg.toLowerCase() !== 'nkwaex')
  if (telegrams.length > 0)
    out.push({
      channel: 'telegram_abuse', channel_name: 'Telegram Impersonation & Fraud Desk', method: 'email',
      recipient: 'abuse@telegram.org', recipient_verified: 1,
      subject: `Fraud report: unauthorized channel ${telegrams.join(', ')} impersonating Yellow Card`,
      body: `To the Telegram Abuse Team,\n\nWe act as authorised agent for Yellow Card (letter SHA-256 ${LETTER}).\n\nChannel: ${telegrams.join(', ')} is promoted on ${f.url} to solicit deposits by impersonating Yellow Card.\n\nObserved:\n${f.claims}\n\nWe request immediate suspension of the handle.`,
    })
  const whatsapps = ((t.capture?.identifiers?.whatsapp ?? []) as string[])
  if (whatsapps.length > 0)
    out.push({
      channel: 'meta_whatsapp', channel_name: 'WhatsApp / Meta Brand Rights Desk', method: 'email',
      recipient: 'phishing@support.whatsapp.com', recipient_verified: 1,
      subject: `Phishing notice: WhatsApp account ${whatsapps.join(', ')} targeting Yellow Card`,
      body: `To the WhatsApp Trust & Safety Team,\n\nWe represent Yellow Card as authorised agent (letter SHA-256 ${LETTER}).\n\nWhatsApp contact: ${whatsapps.join(', ')} is used on phishing site ${f.url} to solicit fraudulent deposits.\n\nObserved:\n${f.claims}\n\nWe request investigation and ban of the account.`,
    })
  return out
}

export function mkNotice(t: Threat, caseId: string, d: Draft, o: Partial<Notice> = {}): Notice {
  return {
    id: rid('ntc'), case_id: caseId, threat_id: t.id, channel: d.channel, channel_name: d.channel_name, method: d.method,
    recipient: d.recipient, recipient_verified: d.recipient_verified, subject: d.subject, body: d.body,
    evidence_refs: {
      threat_id: t.id, html_sha256: t.capture?.html_sha256 ?? 'unknown', screenshot_sha256: t.capture?.screenshot_sha256 ?? 'unknown',
      screenshot_ref: t.capture?.screenshot_ref ?? 'unknown', letter_sha256: LETTER,
    },
    status: 'drafted', drafted_at: t.updated_at, approved_by: null, approved_at: null, filed_at: null,
    ...o,
  }
}

// ---- the seeded scenario -----------------------------------------------------

const TEXT_SCAM = (host: string, phone: string) =>
  `Yellow Card Ghana Customer Support Desk. Double your USDT. Guaranteed returns. Send your deposit to activate your account. Pay via MoMo ${phone}. Telegram @yellowcard_helpdesk. ${host}`

export function makeSeed(): DB {
  const db: DB = { threats: [], cases: [], identifiers: [], notices: [], clock: [], audit: [], clockSeq: 1 }
  const audit = (h: number, actor: string, action: string, ref: string | null, detail: unknown = null) =>
    db.audit.push({ ts: hoursAgo(h), actor, action, ref, detail })
  const clock = (h: number, c: string, n: string | null, channel: string | null, event: ClockEvent['event'], note: string | null = null) =>
    db.clock.push({ id: db.clockSeq++, case_id: c, notice_id: n, channel, event, ts: hoursAgo(h), simulated: 1, note })

  const addThreat = (t: Partial<Threat> & Pick<Threat, 'id' | 'hostname'>, h: number, cap: Capture | null, ver: Verdict | null, enr: Enrichment | null, ids: [string, string][] = [], caseId: string | null = null, ctIdx = 0) => {
    const detected = hoursAgo(h)
    const thr: Threat = {
      brand_id: BRAND_ID, url: null, source: 'certificate_transparency', source_ref: `google_argon2026h2#${3471102118 + ctIdx}`,
      detected_at: detected, stage_a: { reasons: ver ? ver.reason_codes.filter((r) => ['brand_name_exact_label', 'brand_plus_lure_word', 'homoglyph_of_brand', 'typo_of_brand', 'brand_name_in_domain'].includes(r)) : [], priority: 55, seed: 'yellowcard' },
      status: ver ? 'scored' : 'queued', capture: cap, verdict: ver, enrichment: enr, confidence: ver?.confidence ?? null, score: ver?.score ?? null,
      case_id: caseId, updated_at: hoursAgo(h - 0.05), title: cap?.title ?? null, screenshot_ref: cap?.screenshot_ref ?? null, ...t,
    }
    db.threats.push(thr)
    for (const [kind, value] of ids) db.identifiers.push({ threat_id: thr.id, kind, value })
    audit(h, 'system', 'threat_detected', thr.id)
    return thr
  }

  // ---- Case A: a campaign of two sites sharing one MoMo number, partly worked already ----
  const caseA = 'case_9f3a21c7d4'
  db.cases.push({ id: caseA, opened_at: hoursAgo(72), status: 'open', title: 'Suspected clone of Yellow Card' })
  const wallet = 'TQ9mXk3vP2nLrW8aYd5Ht7sZc4JfB6eUo1'
  const t1 = addThreat(
    { id: 'thr_a1c4e8f201', hostname: 'yellowcard-staging.com' }, 72,
    mkCapture('yellowcard-staging.com', { title: 'Yellow Card | Secure Client Portal', text: TEXT_SCAM('yellowcard-staging.com', '024 555 0142'), phones: ['0245550142'], wallets: [wallet], telegram: ['yellowcard_helpdesk'], officialFavicon: true, at: hoursAgo(71.9) }),
    mkVerdict('high', 100, {
      brand_name_exact_label: "hostname yellowcard-staging.com vs seed 'yellowcard'",
      logo_or_favicon_match: 'favicon mmh3 -373997759 equals an official favicon',
      payment_identifier_not_official: { phones: ['0245550142'], wallets: [wallet] },
      brand_named_on_page: "page text contains 'yellow card'",
      lure_language_on_page: ['double your', 'guaranteed returns'],
    }),
    mkEnrichment('yellowcard-staging.com', { registrar: 'NameSilo, LLC', abuse: 'abuse@namesilo.com', created: hoursAgo(96), network: 'Cloudflare, Inc.', ip: '104.21.45.17', hostAbuse: 'abuse@cloudflare.com' }),
    [['phone', '0245550142'], ['wallet', wallet], ['telegram', 'yellowcard_helpdesk']], caseA, 0,
  )
  const t2 = addThreat(
    { id: 'thr_b7d2f9a315', hostname: 'yellowcard-gh.top' }, 50,
    mkCapture('yellowcard-gh.top', { title: 'Yellow Card Ghana: claim your bonus', text: TEXT_SCAM('yellowcard-gh.top', '024 555 0142'), phones: ['0245550142'], telegram: ['yellowcard_helpdesk'], officialFavicon: true, at: hoursAgo(49.9) }),
    mkVerdict('high', 100, {
      brand_name_exact_label: "hostname yellowcard-gh.top vs seed 'yellowcard'",
      logo_or_favicon_match: 'favicon mmh3 -373997759 equals an official favicon',
      payment_identifier_not_official: { phones: ['0245550142'] },
      brand_named_on_page: "page text contains 'yellow card'",
      lure_language_on_page: ['bonus', 'guaranteed returns'],
    }),
    mkEnrichment('yellowcard-gh.top', { registrar: 'Namecheap, Inc.', abuse: 'abuse@namecheap.com', created: hoursAgo(52), network: 'Cloudflare, Inc.', ip: '172.67.188.24', hostAbuse: 'abuse@cloudflare.com' }),
    [['phone', '0245550142'], ['telegram', 'yellowcard_helpdesk']], caseA, 5221,
  )
  audit(72, 'system', 'case_opened', caseA, { first_threat: t1.id })
  audit(50, 'system', 'threat_linked_to_case', t2.id, { case_id: caseA, shared: [{ kind: 'phone', value: '0245550142' }, { kind: 'telegram', value: 'yellowcard_helpdesk' }] })

  const dr1 = draftNotices(t1, caseA), dr2 = draftNotices(t2, caseA)
  const pick = (d: Draft[], ch: string) => d.find((x) => x.channel === ch)!
  const nReg1 = mkNotice(t1, caseA, pick(dr1, 'registrar'), { drafted_at: hoursAgo(71.8), status: 'filed_dry_run', approved_by: 'Kofi Boateng', approved_at: hoursAgo(71), filed_at: hoursAgo(70) })
  const nHost1 = mkNotice(t1, caseA, pick(dr1, 'hosting'), { drafted_at: hoursAgo(71.8), status: 'filed_dry_run', approved_by: 'Kofi Boateng', approved_at: hoursAgo(71), filed_at: hoursAgo(70) })
  const nGsb1 = mkNotice(t1, caseA, pick(dr1, 'google_safe_browsing'), { drafted_at: hoursAgo(71.8), status: 'filed_dry_run', approved_by: 'Kofi Boateng', approved_at: hoursAgo(71), filed_at: hoursAgo(70) })
  const nMtn = mkNotice(t1, caseA, pick(dr1, 'telco_mtn'), { drafted_at: hoursAgo(71.8) })
  const nCsa = mkNotice(t1, caseA, pick(dr1, 'csa'), { drafted_at: hoursAgo(71.8) })
  const nReg2 = mkNotice(t2, caseA, pick(dr2, 'registrar'), { drafted_at: hoursAgo(49.8), status: 'filed_dry_run', approved_by: 'Ama Mensah', approved_at: hoursAgo(25), filed_at: hoursAgo(24) })
  const nHost2 = mkNotice(t2, caseA, pick(dr2, 'hosting'), { drafted_at: hoursAgo(49.8), status: 'rejected', approved_by: 'Kofi Boateng', approved_at: hoursAgo(25) })
  const nGsb2 = mkNotice(t2, caseA, pick(dr2, 'google_safe_browsing'), { drafted_at: hoursAgo(49.8), status: 'approved', approved_by: 'Ama Mensah', approved_at: hoursAgo(1.5) })
  db.notices.push(nReg1, nHost1, nGsb1, nMtn, nCsa, nReg2, nHost2, nGsb2)
  for (const n of [nReg1, nHost1, nGsb1, nMtn, nCsa]) audit(71.8, 'system', 'notice_drafted', n.id, { channel: n.channel, threat_id: n.threat_id })
  for (const n of [nReg2, nHost2, nGsb2]) audit(49.8, 'system', 'notice_drafted', n.id, { channel: n.channel, threat_id: n.threat_id })
  for (const n of [nReg1, nHost1, nGsb1]) { audit(71, 'Kofi Boateng', 'notice_approved', n.id); audit(70, 'Kofi Boateng', 'notice_filed_dry_run', n.id) }
  audit(25, 'Ama Mensah', 'notice_approved', nReg2.id); audit(24, 'Ama Mensah', 'notice_filed_dry_run', nReg2.id)
  audit(25, 'Kofi Boateng', 'notice_rejected', nHost2.id, { reason: 'Same Cloudflare origin as yellowcard-staging.com, covered by the existing hosting notice' })
  audit(1.5, 'Ama Mensah', 'notice_approved', nGsb2.id)

  clock(70, caseA, nReg1.id, 'registrar', 'filed'); clock(66, caseA, nReg1.id, 'registrar', 'first_response', 'Logged by operator (simulated)'); clock(39, caseA, nReg1.id, 'registrar', 'removed', 'Logged by operator (simulated)')
  clock(70, caseA, nHost1.id, 'hosting', 'filed'); clock(66, caseA, nHost1.id, 'hosting', 'first_response', 'Logged by operator (simulated)')
  clock(70, caseA, nGsb1.id, 'google_safe_browsing', 'filed'); clock(67, caseA, nGsb1.id, 'google_safe_browsing', 'removed', 'Logged by operator (simulated)')
  clock(24, caseA, nReg2.id, 'registrar', 'filed')
  audit(66, 'operator', 'clock_first_response', nReg1.id); audit(39, 'operator', 'clock_removed', nReg1.id); audit(67, 'operator', 'clock_removed', nGsb1.id)

  // ---- Case B: a medium-confidence wallet-verification phish, everything still awaiting approval ----
  const caseB = 'case_4be07d92a1'
  db.cases.push({ id: caseB, opened_at: hoursAgo(5), status: 'open', title: 'Suspected clone of Yellow Card' })
  const t3 = addThreat(
    { id: 'thr_c3e9a04d77', hostname: 'yellow-card-wallet.app' }, 5,
    mkCapture('yellow-card-wallet.app', { title: 'Verify your Yellow Card wallet', text: 'Verify your Yellow Card wallet within 24 hours to avoid suspension. Send the verification fee to 020 077 1234.', phones: ['0200771234'], at: hoursAgo(4.9), server: 'Vercel' }),
    mkVerdict('medium', 65, {
      brand_plus_lure_word: "hostname yellow-card-wallet.app vs seed 'yellow-card'",
      brand_named_on_page: "page text contains 'yellow card'",
      payment_identifier_not_official: { phones: ['0200771234'] },
    }),
    mkEnrichment('yellow-card-wallet.app', { registrar: 'Porkbun LLC', abuse: 'abuse@porkbun.com', created: hoursAgo(20), network: 'Vercel Inc.', ip: '76.76.21.21', hostAbuse: 'abuse@vercel.com' }),
    [['phone', '0200771234']], caseB, 9120,
  )
  audit(5, 'system', 'case_opened', caseB, { first_threat: t3.id })
  for (const d of draftNotices(t3, caseB)) {
    const n = mkNotice(t3, caseB, d, { drafted_at: hoursAgo(4.8) })
    db.notices.push(n)
    audit(4.8, 'system', 'notice_drafted', n.id, { channel: n.channel, threat_id: t3.id })
  }

  // ---- Threats that did not open a case ----
  addThreat(
    { id: 'thr_d5a1b6c902', hostname: 'yellowcard-academy-blog.org' }, 30,
    mkCapture('yellowcard-academy-blog.org', { title: 'Notes from a Yellow Card user', text: 'A fan blog about local crypto exchanges. Not affiliated. No payments requested.', at: hoursAgo(29.9), server: 'nginx' }),
    mkVerdict('low', 25, { brand_name_in_domain: "hostname yellowcard-academy-blog.org vs seed 'yellowcard'", brand_named_on_page: "page text contains 'yellow card'" }),
    null, [], null, 3300,
  )
  addThreat(
    { id: 'thr_e8f2c7b114', hostname: 'yellowcard-pay.site' }, 8,
    mkCapture('yellowcard-pay.site', { title: null, text: '', at: hoursAgo(7.9), errors: ['net::ERR_NAME_NOT_RESOLVED'] }),
    mkVerdict('unknown', 30, { brand_plus_lure_word: "hostname yellowcard-pay.site vs seed 'yellowcard'", page_unreachable: 'net::ERR_NAME_NOT_RESOLVED' }),
    null, [], null, 7710,
  )
  return db
}
