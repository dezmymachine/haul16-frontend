import { AlertTriangle, Check, Circle, Loader2, MinusCircle } from 'lucide-react'
import type { ScanSource } from '@/api'

function detail(s: ScanSource): string {
  if (s.status === 'skipped') return s.reason ?? 'Skipped'
  if (s.status === 'error') return s.reason ?? 'Failed'
  const bits: string[] = []
  if (s.generated != null) bits.push(`${s.checked ?? 0} of ${s.generated} variants checked, ${s.registered ?? 0} exist`)
  else if (s.checked != null) bits.push(`${s.checked} accounts checked, ${s.existing ?? 0} exist`)
  if (s.found != null) bits.push(`${s.found} found`)
  if (s.queued) bits.push(`${s.queued} sent for analysis`)
  if (s.already_tracked) bits.push(`${s.already_tracked} already tracked`)
  if (s.articles != null) bits.push(`${s.articles} press warning${s.articles === 1 ? '' : 's'}`)
  return bits.join(' · ')
}

/** What the last scan did, source by source, including what was skipped and why. */
export function ScanSources({ sources }: { sources: Record<string, ScanSource> }) {
  const rows = Object.entries(sources)
  if (!rows.length) return null
  return (
    <ul className="grid gap-1">
      {rows.map(([id, s]) => (
        <li key={id} className="flex items-start gap-3 rounded-md px-1 py-1.5">
          <span className="mt-0.5 shrink-0">
            {s.status === 'ok' ? <Check className="size-4 text-emerald-600" /> : s.status === 'running' ? <Loader2 className="size-4 animate-spin text-primary" /> :
             s.status === 'skipped' ? <MinusCircle className="size-4 text-muted-foreground" /> : s.status === 'error' ? <AlertTriangle className="size-4 text-destructive" /> :
             <Circle className="size-4 text-muted-foreground/50" />}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium">{s.label}</div>
            {detail(s) ? <div className="text-xs text-muted-foreground">{detail(s)}</div> : null}
          </div>
        </li>
      ))}
    </ul>
  )
}
