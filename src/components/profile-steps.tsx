import { AlertTriangle, Check, Circle, Loader2, MinusCircle } from 'lucide-react'
import type { StepState } from '@/api'
import { cn } from '@/lib/utils'

export const STEP_LABEL: Record<string, string> = {
  inputs: 'What you entered',
  dns: 'DNS and email provider',
  rdap: 'Registrar and hosting',
  website: 'Website pages',
  assets: 'Logos and favicon',
  linkedin: 'LinkedIn company page',
  socials: 'Social and Telegram profiles',
  news: 'News and press warnings',
  dossier: 'AI extraction with citations',
}

function summary(s: StepState): string {
  if (s.status === 'skipped') return s.reason ?? 'Skipped'
  if (s.status === 'error') return s.error ?? 'Failed'
  const parts = Object.entries(s)
    .filter(([k, v]) => !['status', 'started_at'].includes(k) && typeof v === 'number')
    .map(([k, v]) => `${v} ${v === 1 ? k.replace(/s$/, '') : k}`)
  return parts.join(' · ')
}

/** The profiler's collectors, one row each, so it is clear what ran, what was skipped and why. */
export function ProfileSteps({ steps }: { steps: Record<string, StepState> }) {
  const names = Object.keys(STEP_LABEL).filter((k) => steps[k])
  return (
    <ol className="grid gap-1">
      {names.map((name) => {
        const s = steps[name]
        return (
          <li key={name} className="flex items-start gap-3 rounded-md px-2 py-2">
            <span className="mt-0.5">
              {s.status === 'ok' ? <Check className="size-4 text-emerald-600" /> : s.status === 'running' ? <Loader2 className="size-4 animate-spin text-primary" /> :
               s.status === 'skipped' ? <MinusCircle className="size-4 text-muted-foreground" /> : s.status === 'error' ? <AlertTriangle className="size-4 text-destructive" /> :
               <Circle className="size-4 text-muted-foreground/50" />}
            </span>
            <div className="min-w-0">
              <div className={cn('text-sm font-medium', s.status === 'pending' && 'text-muted-foreground')}>{STEP_LABEL[name]}</div>
              {summary(s) ? <div className="text-xs text-muted-foreground">{summary(s)}</div> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
