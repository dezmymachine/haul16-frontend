import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { api, type ProfileFact, type Verification } from '@/api'
import { Mono } from '@/ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const VERIFY_LABEL: Record<Verification, string> = {
  verified: 'verified',
  corroborated: 'official site only',
  single_source: 'one outside source',
  conflicting: 'conflicting',
}
const VERIFY_VARIANT: Record<Verification, 'ok' | 'unknown' | 'medium' | 'high'> = {
  verified: 'ok',
  corroborated: 'unknown',
  single_source: 'medium',
  conflicting: 'high',
}

export function VerificationBadge({ v }: { v: Verification }) {
  return <Badge variant={VERIFY_VARIANT[v]}>{VERIFY_LABEL[v]}</Badge>
}

const MONO_KINDS = new Set(['domain', 'phone', 'email', 'wallet', 'registration_no', 'dns', 'domain_registration', 'bank_account'])

/** One-line human summary of a fact's structured data. */
function detail(f: ProfileFact): string | null {
  const d = f.data ?? {}
  switch (f.kind) {
    case 'dns':
      return [d.email_provider && `Email: ${d.email_provider}`, d.ns?.length && `${d.ns.length} nameservers`, d.a?.length && `${d.a.length} IPs`, d.spf && 'SPF set'].filter(Boolean).join(' · ') || null
    case 'domain_registration':
      return [d.registrar && `Registrar: ${d.registrar}`, d.created && `Created ${String(d.created).slice(0, 10)}`, d.hosting_network && `Hosting: ${d.hosting_network}`].filter(Boolean).join(' · ') || null
    case 'telegram':
      return [d.kind, d.audience && `${Number(d.audience).toLocaleString()} ${d.kind === 'channel' ? 'subscribers' : 'members'}`, d.description].filter(Boolean).join(' · ') || null
    case 'linkedin_profile':
      return [d.followers && `${Number(d.followers).toLocaleString()} followers`, d.employees && `${d.employees} employees`, d.industry, d.tagline].filter(Boolean).join(' · ') || null
    case 'news':
    case 'warning':
      return [d.source, d.age, d.snippet].filter(Boolean).join(' · ') || null
    default:
      return null
  }
}

/** A single sourced fact: the value, why we believe it, where it came from, and the review action when a person must decide. */
export function FactRow({ f, brandId, canReview = true }: { f: ProfileFact; brandId: string; canReview?: boolean }) {
  const qc = useQueryClient()
  const review = useMutation({
    mutationFn: (action: 'confirm' | 'reject') => api.factReview(brandId, f.id, action),
    onSuccess: (_r, action) => {
      toast.success(action === 'confirm' ? 'Confirmed. It can now be used for detection.' : 'Rejected')
      qc.invalidateQueries({ queryKey: ['profile', brandId] })
      qc.invalidateQueries({ queryKey: ['brands'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const needsDecision = canReview && f.review_status === 'pending' && (f.needs_confirmation || f.verification === 'conflicting')
  const text = detail(f)
  const isLink = f.kind === 'news' || f.kind === 'warning' || f.kind === 'source' || f.kind === 'app' || f.kind === 'social' || f.kind === 'telegram' || f.kind === 'linkedin_profile'
  const title = f.label && (f.kind === 'news' || f.kind === 'warning' || f.kind === 'source') ? f.label : f.value
  return (
    <li className="grid gap-1.5 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {isLink && f.value.startsWith('http') ? (
            <a href={f.value} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 font-medium break-all">
              {title} <ExternalLink className="size-3 shrink-0" />
            </a>
          ) : MONO_KINDS.has(f.kind) ? (
            <Mono className="text-sm">{f.value}</Mono>
          ) : (
            <span className="font-medium break-words">{title}</span>
          )}
          <VerificationBadge v={f.verification} />
          {f.review_status === 'confirmed' ? <Badge variant="ok">confirmed</Badge> : null}
          {f.review_status === 'rejected' ? <Badge variant="secondary">rejected</Badge> : null}
          {needsDecision ? <Badge variant="warn">needs your decision</Badge> : null}
        </div>
        {f.label && !(f.kind === 'news' || f.kind === 'warning' || f.kind === 'source') ? <div className="text-sm text-muted-foreground">{f.label}</div> : null}
        {text ? <div className="text-sm text-muted-foreground">{text}</div> : null}
        <div className="mt-1 text-xs text-muted-foreground">
          {f.collector}
          {f.source_url && f.source_url !== f.value ? (
            <>
              {' · '}
              <a href={f.source_url} target="_blank" rel="noreferrer" className="break-all">source</a>
            </>
          ) : null}
          {' · '}confidence {Math.round(f.confidence * 100)}%
        </div>
      </div>
      {needsDecision ? (
        <div className="flex gap-2">
          <Button size="sm" disabled={review.isPending} onClick={() => review.mutate('confirm')}>Confirm</Button>
          <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => review.mutate('reject')}>Reject</Button>
        </div>
      ) : null}
    </li>
  )
}
