// Typed client for the HAUL16 FastAPI backend. Everything is a dry run.
// When no backend is reachable the client serves built-in sample data (see src/demo.ts and src/mock/).
import { demoEnabled } from './demo'
import { demoScreenshot } from './mock/screens'
import { getSelectedBrandId } from './brand'

export type Confidence = 'high' | 'medium' | 'low' | 'unknown'

export interface Verdict {
  confidence: Confidence
  score: number
  reason_codes: string[]
  evidence: Record<string, unknown>
  rules_version: string
  human_review_required: boolean
}

export interface Capture {
  url: string
  final_url: string | null
  status: number | null
  captured_at: string
  capture_tool: string
  title: string | null
  html_sha256: string | null
  screenshot_ref: string | null
  screenshot_sha256: string | null
  favicon_url: string | null
  favicon_mmh3: number | null
  server_headers: Record<string, string>
  text_excerpt: string
  identifiers: { phones?: string[]; wallets?: Record<string, string[]>; telegram?: string[]; whatsapp?: string[] }
  blocked_requests: string[]
  errors: string[]
}

export interface Enrichment {
  host: string
  registered_domain: string | null
  free_host_platform: string | null
  ips: string[]
  registration?: { domain: string; registrar?: string; registrar_abuse_email?: string; created?: string; rdap_status?: number }
  hosting?: { ip: string; network?: string; country?: string; host_abuse_email?: string; rdap_status?: number }
  error?: string
}

export interface Threat {
  id: string
  brand_id: string
  hostname: string
  url: string | null
  source: string
  source_ref: string | null
  detected_at: string
  stage_a: { reasons?: string[]; priority?: number; seed?: string } | null
  status: string
  capture?: Capture | null
  verdict?: Verdict | null
  enrichment?: Enrichment | null
  confidence: Confidence | null
  score: number | null
  case_id: string | null
  updated_at: string
  title?: string | null
  screenshot_ref?: string | null
}

export interface CaseSummary {
  id: string
  brand_id: string
  opened_at: string
  status: string
  title: string
  threat_count: number
  max_score: number | null
  first_detected: string
  notice_count: number
  filed_count: number
  removed_count: number
}

export type NoticeStatus = 'drafted' | 'approved' | 'filed_dry_run' | 'rejected'

export interface Notice {
  id: string
  case_id: string
  threat_id: string
  channel: string
  channel_name: string
  method: string
  recipient: string
  recipient_verified: number
  subject: string
  body: string
  evidence_refs: Record<string, string>
  status: NoticeStatus
  drafted_at: string
  approved_by: string | null
  approved_at: string | null
  filed_at: string | null
}

export interface NoticeRow extends Notice {
  case_title: string
  host: string | null
}

export interface ClockEvent {
  id: number
  case_id: string
  notice_id: string | null
  channel: string | null
  event: 'filed' | 'first_response' | 'removed' | 'detected'
  ts: string
  simulated: number
  note: string | null
}

export interface AuditRow {
  ts: string
  actor: string
  action: string
  ref: string | null
  detail: unknown
}

export interface CaseDetail extends CaseSummary {
  threats: Threat[]
  identifiers: { kind: string; value: string; hosts: string; n: number }[]
  notices: Notice[]
  clock: ClockEvent[]
  audit: AuditRow[]
}

export interface CtStats {
  status: string
  logs: number
  certs: number
  unique_domains: number
  hits: number
  certs_per_s: number
  uptime_s: number
  backlog: Record<string, number>
  rate_now?: number
}

export interface Stats {
  counts: {
    threats: number
    by_confidence: Record<string, number>
    open_cases: number
    notices_drafted: number
    notices_awaiting_approval: number
    notices_filed: number
  }
  ct: CtStats
  queue: number
  dry_run: boolean
}

export interface Report {
  brand: string
  month: string
  generated_at: string
  dry_run: boolean
  limitations: string[]
  threats_detected: number
  threats_by_confidence: Record<string, number>
  cases_opened: number
  notices: Record<NoticeStatus, number>
  channels: {
    channel: string
    filed: number
    first_response: number
    removed: number
    median_detect_to_removed_min: number | null
    median_file_to_removed_min: number | null
  }[]
  cases: { id: string; opened_at: string; threats: number; filed: number; removed: number; status: string }[]
}

export interface BrandRegister {
  brand_id: string
  display_name: string
  fictional?: boolean
  seed_terms: string[]
  official_domains: string[]
  official_handles?: Record<string, string>
  official_numbers?: string[]
  official_wallets?: string[]
  official_favicon_mmh3?: number[]
  allowlist_domains?: string[]
  authorisation_letter: { ref: string; sha256: string }
}

// ---- brands and the identity dossier ----

export type Verification = 'verified' | 'corroborated' | 'single_source' | 'conflicting'
export type ReviewStatus = 'pending' | 'confirmed' | 'rejected'

export interface BrandSummary {
  id: string
  display_name: string
  website: string | null
  linkedin_url: string | null
  status: 'draft' | 'profiling' | 'ready'
  ownership_status: 'unverified' | 'verified'
  verified_at: string | null
  fictional: boolean
  authorisation_letter_ref: string | null
  authorisation_letter_sha256: string | null
  seed_terms: string[]
  active_version: number | null
  is_active: boolean
  created_at: string
  updated_at: string
  fact_counts?: Record<string, number>
}

export interface VerifyInstructions {
  domain: string | null
  record_name: string | null
  record_type: 'TXT'
  record_value: string
}

export interface StepState {
  status: 'pending' | 'running' | 'ok' | 'skipped' | 'error'
  reason?: string
  error?: string
  [k: string]: unknown
}

export interface JobStatus {
  id?: number
  status: 'none' | 'queued' | 'running' | 'done' | 'failed'
  attempts?: number
  error?: string | null
  steps: Record<string, StepState>
  version?: number | null
}

export interface ProfileFact {
  id: string
  kind: string
  value: string
  label: string | null
  data: Record<string, any>
  source_url: string | null
  collector: string
  confidence: number
  verification: Verification
  review_status: ReviewStatus
  needs_confirmation: boolean
  fetched_at: string
}

export interface ProfilePerson {
  id: string
  name: string
  title: string | null
  profile_url: string | null
  photo_url: string | null
  bio: string | null
  source_url: string | null
  collector: string
  verification: Verification
  review_status: ReviewStatus
}

export interface ProfileAsset {
  id: string
  kind: string
  url: string | null
  sha256: string | null
  phash: string | null
  mmh3: number | null
  meta: Record<string, any>
  source_url: string | null
}

export interface Profile {
  brand: BrandSummary & { verification: VerifyInstructions }
  job: JobStatus | null
  groups: Record<string, ProfileFact[]>
  people: ProfilePerson[]
  assets: ProfileAsset[]
  summary: { steps?: Record<string, StepState>; counts?: Record<string, number>; conflicts?: number; needs_review?: number } | null
  conflicts: string[]
  needs_review: string[]
}

export interface BrandInput {
  display_name: string
  website?: string
  linkedin_url?: string
  socials?: string[]
  extra_domains?: string[]
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const brandId = getSelectedBrandId()
  if (await demoEnabled()) {
    const { handleMock } = await import('./mock/server')
    return (await handleMock(path, { ...init, headers: { ...(brandId ? { 'x-brand-id': brandId } : {}), ...(init?.headers ?? {}) } })) as T
  }
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(brandId ? { 'x-brand-id': brandId } : {}), ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') msg = body.detail
      else if (Array.isArray(body.detail)) msg = body.detail.map((d: { msg: string }) => d.msg).join('; ')
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, msg)
  }
  return res.json() as Promise<T>
}

const post = <T,>(path: string, body?: unknown) =>
  req<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

export const api = {
  stats: () => req<Stats>('/api/stats'),
  brand: () => req<BrandRegister>('/api/brand'),
  threats: (confidence?: string) =>
    req<Threat[]>(`/api/threats${confidence ? `?confidence=${encodeURIComponent(confidence)}` : ''}`),
  threat: (id: string) => req<Threat>(`/api/threats/${id}`),
  cases: () => req<CaseSummary[]>('/api/cases'),
  case: (id: string) => req<CaseDetail>(`/api/cases/${id}`),
  notices: (status?: NoticeStatus) =>
    req<NoticeRow[]>(`/api/notices${status ? `?status=${status}` : ''}`),
  redraft: (id: string) => post<{ drafted: number }>(`/api/cases/${id}/redraft`),
  approve: (id: string, approver: string) => post<Notice>(`/api/notices/${id}/approve`, { approver }),
  reject: (id: string, approver: string, reason: string) =>
    post<Notice>(`/api/notices/${id}/reject`, { approver, reason }),
  file: (id: string) => post<Notice>(`/api/notices/${id}/file`),
  clock: (id: string, event: 'first_response' | 'removed', note?: string) =>
    post<ClockEvent[]>(`/api/notices/${id}/clock`, { event, note }),
  inject: (url: string, as_host?: string) =>
    post<{ threat_id: string | null; duplicate: boolean }>('/api/inject', { url, as_host: as_host || null }),
  demoClone: (variant: 'clone' | 'clone2' | 'decoy') =>
    post<{ threat_id: string | null; duplicate: boolean; host: string }>('/api/demo/clone', { variant }),
  demoReset: () => post<{ ok: boolean }>('/api/demo/reset'),
  report: (month: string) => req<Report>(`/api/report?month=${month}`),
  audit: () => req<AuditRow[]>('/api/audit'),
  brands: () => req<BrandSummary[]>('/api/brands'),
  brandCreate: (body: BrandInput) => post<BrandSummary & { verification: VerifyInstructions }>('/api/brands', body),
  brandGet: (id: string) => req<BrandSummary & { verification: VerifyInstructions; job: JobStatus | null }>(`/api/brands/${id}`),
  profile: (id: string) => req<Profile>(`/api/brands/${id}/profile`),
  profileStatus: (id: string) => req<JobStatus>(`/api/brands/${id}/profile/status`),
  profileRun: (id: string) => post<JobStatus>(`/api/brands/${id}/profile/run`),
  brandVerify: (id: string) => post<{ verified: boolean; domain?: string; reason?: string | null }>(`/api/brands/${id}/verify`),
  factReview: (brandId: string, factId: string, action: 'confirm' | 'reject') => post<{ ok: boolean }>(`/api/brands/${brandId}/facts/${factId}/${action}`),
  letterUpload: (id: string, filename: string, content_base64: string) =>
    post<{ ref: string; sha256: string; bytes: number }>(`/api/brands/${id}/letter`, { filename, content_base64 }),
  brandActivate: (id: string) => post<{ active: string }>(`/api/brands/${id}/activate`),
}

export function evidenceUrl(ref: string | null | undefined): string | null {
  if (!ref) return null
  if (ref.startsWith('demo:')) return demoScreenshot(ref.slice(5))
  const name = ref.split('/').pop()!
  return `/api/evidence/${encodeURIComponent(name)}`
}
