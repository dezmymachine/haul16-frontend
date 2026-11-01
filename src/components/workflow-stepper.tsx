import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CaseDetail, Threat } from '@/api'

export const STEPS = ['Detected', 'Scored', 'Case', 'Approved', 'Filed', 'Removed'] as const

/** Index of the last completed step (0-5) for a threat on its own. */
export function threatReached(t: Threat) {
  if (t.case_id) return 2
  return t.status === 'queued' ? 0 : 1
}

/** Index of the last completed step for a whole case. */
export function caseReached(c: Pick<CaseDetail, 'notices' | 'clock'>) {
  if (c.clock.some((e) => e.event === 'removed')) return 5
  if (c.notices.some((n) => n.status === 'filed_dry_run' || n.status === 'filed')) return 4
  if (c.notices.some((n) => n.status === 'approved')) return 3
  return 2
}

/** The shared pipeline: Detected -> Scored -> Case -> Approved -> Filed -> Removed. */
export function WorkflowStepper({ reached, className }: { reached: number; className?: string }) {
  return (
    <ol className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-xs', className)} aria-label="Workflow progress">
      {STEPS.map((label, i) => {
        const done = i <= reached
        const current = i === reached + 1
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-2 py-0.5',
                done && 'border-transparent bg-ok text-ok-foreground',
                current && 'border-primary text-primary',
                !done && !current && 'text-muted-foreground',
              )}
              aria-current={current ? 'step' : undefined}
            >
              {done ? <Check className="size-3" /> : <span className="tabular-nums">{i + 1}</span>}
              {label}
            </span>
            {i < STEPS.length - 1 ? <span className="h-px w-3 bg-border" aria-hidden="true" /> : null}
          </li>
        )
      })}
    </ol>
  )
}
