import type { ReactNode } from 'react'
import { type Threat, evidenceUrl } from '@/api'
import { ConfidenceChip, Hash, Mono, REASON_LABEL, fmtTime } from '@/ui'
import { Alert, AlertDescription } from '@/components/ui/alert'

function show(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => (Array.isArray(x) ? x.length : x))
      .map(([k, x]) => `${k}: ${show(x)}`)
      .join(' · ')
  }
  return String(v)
}

const None = () => <span className="text-muted-foreground">none</span>

export function KV({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Everything we captured about one threat. Each verdict line points at its evidence. */
export function ThreatEvidence({ t }: { t: Threat }) {
  const cap = t.capture
  const v = t.verdict
  const enr = t.enrichment
  const shot = evidenceUrl(cap?.screenshot_ref)
  const ids = cap?.identifiers ?? {}
  const wallets = Object.entries(ids.wallets ?? {}).flatMap(([k, ws]) => ws.map((w) => `${w} (${k})`))
  const social = [...(ids.telegram ?? []).map((x) => `t.me/${x}`), ...(ids.whatsapp ?? []).map((x) => `wa.me/${x}`)].join(', ')

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
      <div className="grid content-start gap-2">
        {shot ? (
          <a href={shot} target="_blank" rel="noreferrer" title="Open full screenshot" className="block overflow-hidden rounded-md border">
            <img src={shot} alt={`Screenshot of ${t.hostname}`} loading="lazy" className="w-full" />
          </a>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-md border border-dashed bg-muted text-sm text-muted-foreground">
            {t.status === 'queued' ? 'Capture pending…' : 'No screenshot (page unreachable)'}
          </div>
        )}
        {cap?.title ? <div className="truncate text-xs text-muted-foreground">“{cap.title}”</div> : null}
      </div>

      <div className="grid content-start gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <ConfidenceChip value={t.status === 'queued' ? 'pending' : t.confidence} />
          {v ? <span className="text-xs text-muted-foreground">score {v.score} · rules {v.rules_version} · human review required</span> : null}
        </div>

        {v ? (
          <ul className="grid gap-1 text-sm">
            {v.reason_codes.map((code) => (
              <li key={code}>
                <strong className="font-medium">{REASON_LABEL[code] ?? code}</strong>
                <span className="text-xs text-muted-foreground"> {show(v.evidence[code])}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <KV
          rows={[
            ['URL', <Mono>{cap?.final_url ?? cap?.url ?? t.url ?? `https://${t.hostname}/`}</Mono>],
            ['Captured', <>{fmtTime(cap?.captured_at)} <span className="text-xs text-muted-foreground">{cap?.capture_tool}</span></>],
            ['Page SHA-256', <Hash value={cap?.html_sha256} />],
            ['Screenshot SHA-256', <Hash value={cap?.screenshot_sha256} />],
            ['Favicon mmh3', cap?.favicon_mmh3 != null ? <Mono>{cap.favicon_mmh3}</Mono> : <None />],
            ['Phones on page', ids.phones?.length ? <Mono>{ids.phones.join(', ')}</Mono> : <None />],
            ['Wallets', wallets.length ? <Mono>{wallets.join(', ')}</Mono> : <None />],
            ['Telegram / WhatsApp', social || <None />],
            ...(enr?.telegram ? [['Telegram account', <>{enr.telegram.title} <span className="text-xs text-muted-foreground">· {enr.telegram.kind}{enr.telegram.audience ? `, ${enr.telegram.audience.toLocaleString()} ${enr.telegram.kind === 'channel' ? 'subscribers' : 'members'}` : ''}{enr.telegram.bot ? ', bot' : ''}</span>{enr.telegram.description ? <div className="text-xs text-muted-foreground">{enr.telegram.description}</div> : null}</>] as [string, ReactNode]] : []),
            ...(enr?.whatsapp_groups?.length ? [['WhatsApp groups', <>{enr.whatsapp_groups.map((g) => <div key={g.code}>{g.name} <span className="font-mono text-xs text-muted-foreground">{g.url}</span></div>)}</>] as [string, ReactNode]] : []),
            ...(enr?.platform ? [] : [[
              'Registrar',
              enr?.registration?.registrar ? (
                <>
                  {enr.registration.registrar}
                  {enr.registration.created ? <span className="text-xs text-muted-foreground"> · created {fmtTime(enr.registration.created)}</span> : null}
                  {enr.registration.registrar_abuse_email ? <div className="font-mono text-xs">{enr.registration.registrar_abuse_email}</div> : null}
                </>
              ) : enr?.free_host_platform ? (
                <span>Free host: <Mono>{enr.free_host_platform}</Mono></span>
              ) : enr?.registration?.rdap_status === 404 ? (
                <span className="text-muted-foreground">not found in registry RDAP (unregistered or demo host)</span>
              ) : (
                <span className="text-muted-foreground">unknown</span>
              ),
            ],
            [
              'Hosting',
              enr?.hosting?.network ? (
                <>
                  {enr.hosting.network} <Mono>{enr.hosting.ip}</Mono>
                  {enr.hosting.host_abuse_email ? <div className="font-mono text-xs">{enr.hosting.host_abuse_email}</div> : null}
                </>
              ) : (
                <span className="text-muted-foreground">{enr?.ips?.length ? enr.ips.join(', ') : 'unknown'}</span>
              ),
            ]] as [string, ReactNode][]),
          ]}
        />
        {cap?.errors?.length ? (
          <Alert variant="destructive">
            <AlertDescription>Capture: {cap.errors.join('; ')}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </div>
  )
}
