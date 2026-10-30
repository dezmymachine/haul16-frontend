import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api, type Threat } from '@/api'
import { ConfidenceChip, Empty, ErrorNote, Reason, fmtTime } from '@/ui'
import { Page } from '@/components/page'
import { PageHeader } from '@/components/page-header'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const FILTERS = ['all', 'high', 'medium', 'low', 'unknown'] as const
type Filter = (typeof FILTERS)[number]

export const Route = createFileRoute('/threats/')({
  validateSearch: (s: Record<string, unknown>): { confidence?: Filter } => ({
    confidence: (FILTERS as readonly unknown[]).includes(s.confidence) ? (s.confidence as Filter) : undefined,
  }),
  component: ThreatsPage,
})

function ThreatsPage() {
  const { confidence = 'all' } = Route.useSearch()
  const navigate = Route.useNavigate()
  const q = useQuery({
    queryKey: ['threats', confidence],
    queryFn: () => api.threats(confidence === 'all' ? undefined : confidence),
    refetchInterval: 15_000,
  })
  return (
    <Page crumbs={[{ label: 'Monitor' }, { label: 'Threats' }]}>
      <PageHeader
        title="Threats"
        description="Step 2: triage. Every hostname that matched the brand, with what the capture found. Nothing here is “safe”: unknown means we could not see the page yet."
        actions={
          <ToggleGroup
            type="single"
            variant="outline"
            value={confidence}
            onValueChange={(v) => v && navigate({ search: { confidence: v as Filter } })}
            aria-label="Filter by confidence"
          >
            {FILTERS.map((f) => (
              <ToggleGroupItem key={f} value={f} className="px-3 capitalize">{f}</ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      />
      <ErrorNote error={q.error} />
      {q.isPending ? <Skeleton className="h-48 w-full" /> : null}
      {q.data && !q.data.length ? <Empty>No threats in this view yet. Start from Watch.</Empty> : null}
      {q.data?.length ? (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hostname</TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead>Why</TableHead>
                <TableHead>Detected</TableHead>
                <TableHead>Case</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.map((t) => (
                <ThreatRow key={t.id} t={t} />
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}
    </Page>
  )
}

function ThreatRow({ t }: { t: Threat }) {
  const reasons = t.verdict?.reason_codes ?? t.stage_a?.reasons ?? []
  return (
    <TableRow>
      <TableCell>
        <Link to="/threats/$threatId" params={{ threatId: t.id }} className="font-mono text-sm">{t.hostname}</Link>
        {t.title ? <div className="max-w-xs truncate text-xs text-muted-foreground">{t.title}</div> : null}
      </TableCell>
      <TableCell><ConfidenceChip value={t.status === 'queued' ? 'pending' : t.confidence} /></TableCell>
      <TableCell className="text-right tabular-nums">{t.score ?? '—'}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {reasons.slice(0, 3).map((r) => <Reason key={r} code={r} />)}
          {reasons.length > 3 ? <span className="text-xs text-muted-foreground">+{reasons.length - 3}</span> : null}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs">{fmtTime(t.detected_at)}</TableCell>
      <TableCell>
        {t.case_id ? (
          <Link to="/cases/$caseId" params={{ caseId: t.case_id }} className="font-mono text-xs">{t.case_id}</Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  )
}
