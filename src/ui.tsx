import { useEffect, useState, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import type { Confidence, NoticeStatus } from '@/api'
import { useSession } from '@/session'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty as EmptyBox, EmptyDescription, EmptyHeader } from '@/components/ui/empty'
import { cn } from '@/lib/utils'

export const REASON_LABEL: Record<string, string> = {
  payment_identifier_not_official: 'Unofficial payment number or wallet',
  logo_or_favicon_match: 'Copied logo / favicon',
  homoglyph_of_brand: 'Look-alike characters',
  brand_named_on_page: 'Brand named on page',
  lure_language_on_page: 'Lure wording',
  brand_plus_lure_word: 'Brand + lure word in domain',
  typo_of_brand: 'Typo of brand',
  brand_name_exact_label: 'Brand name on other domain',
  brand_name_in_domain: 'Brand name in domain',
  free_hosting_subdomain: 'Free hosting subdomain',
  page_unreachable: 'Page unreachable',
}

export const CHANNEL_LABEL: Record<string, string> = {
  registrar: 'Registrar',
  hosting: 'Hosting provider',
  google_safe_browsing: 'Google Safe Browsing',
  telco_mtn: 'MTN MoMo fraud',
  telco_telecel: 'Telecel fraud',
  telco_airteltigo: 'AT fraud',
  csa: 'Cyber Security Authority',
}

export function ConfidenceChip({ value }: { value: Confidence | string | null | undefined }) {
  const v = value ?? 'pending'
  const variant = (['high', 'medium', 'low', 'unknown'].includes(v) ? v : 'outline') as 'high' | 'medium' | 'low' | 'unknown' | 'outline'
  return <Badge variant={variant}>{v}</Badge>
}

const STATUS_VARIANT: Record<NoticeStatus, 'warn' | 'default' | 'ok' | 'secondary'> = {
  drafted: 'warn',
  approved: 'default',
  filed_dry_run: 'ok',
  rejected: 'secondary',
}

export function StatusChip({ value }: { value: string }) {
  const label = value === 'filed_dry_run' ? 'filed (dry run)' : value
  const variant = STATUS_VARIANT[value as NoticeStatus] ?? 'outline'
  return <Badge variant={variant}>{label}</Badge>
}

export function Reason({ code }: { code: string }) {
  return (
    <Badge variant="outline" className="font-normal" title={code}>
      {REASON_LABEL[code] ?? code}
    </Badge>
  )
}

export function Mono({ children, title, className }: { children: ReactNode; title?: string; className?: string }) {
  return (
    <code className={cn('font-mono text-[0.85em] break-all', className)} title={title}>
      {children}
    </code>
  )
}

export function Hash({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground">unknown</span>
  return <Mono title={value}>{value.slice(0, 16)}…</Mono>
}

export function fmtTime(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function fmtDuration(ms: number) {
  if (ms < 0) ms = 0
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d) return `${d}d ${h}h ${m}m`
  if (h) return `${h}h ${m}m ${sec}s`
  if (m) return `${m}m ${sec}s`
  return `${sec}s`
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

export function Ago({ iso }: { iso: string }) {
  const now = useNow(5000)
  return <span title={iso}>{fmtDuration(now - new Date(iso).getTime())} ago</span>
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'warn' | 'good' }) {
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={cn('text-3xl font-semibold tabular-nums', tone === 'warn' && 'text-signal', tone === 'good' && 'text-ok-foreground')}
        >
          {value}
        </CardTitle>
      </CardHeader>
      {sub ? <CardContent className="px-4 text-xs text-muted-foreground">{sub}</CardContent> : null}
    </Card>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <EmptyBox className="border border-dashed">
      <EmptyHeader>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
    </EmptyBox>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>{error instanceof Error ? error.message : String(error)}</AlertDescription>
    </Alert>
  )
}

const APPROVER_KEY = 'haul16.approver'
const approverListeners = new Set<() => void>()

function readApprover() {
  try {
    return localStorage.getItem(APPROVER_KEY) ?? ''
  } catch {
    return ''
  }
}

/** Who is deciding. The signed-in person when sign-in is on (the server records the session name, not what we send);
 *  otherwise a name typed in the account menu and kept in localStorage. Returns [name, setName, locked]. */
export function useApprover(): [string, (v: string) => void, boolean] {
  const { session } = useSession()
  const [v, setV] = useState('')
  useEffect(() => {
    const sync = () => setV(readApprover())
    sync()
    approverListeners.add(sync)
    return () => void approverListeners.delete(sync)
  }, [])
  const locked = !!session?.auth_enabled
  return [
    locked ? session!.name : v,
    (nv: string) => {
      try {
        localStorage.setItem(APPROVER_KEY, nv)
      } catch {
        /* storage blocked */
      }
      approverListeners.forEach((fn) => fn())
    },
    locked,
  ]
}
