import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import { Empty, ErrorNote, StatusChip, fmtTime } from '@/ui'
import { Page } from '@/components/page'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export const Route = createFileRoute('/cases/')({ component: CasesPage })

function CasesPage() {
  const q = useQuery({ queryKey: ['cases'], queryFn: api.cases, refetchInterval: 15_000 })
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats })
  const awaiting = stats.data?.counts.notices_awaiting_approval ?? 0
  return (
    <Page crumbs={[{ label: 'Respond' }, { label: 'Cases' }]}>
      <PageHeader
        title="Cases"
        description="Step 3: a case opens when a capture scores medium or high. Threats that share a MoMo number, wallet or Telegram handle join the same case."
        actions={
          awaiting ? (
            <Link to="/approvals"><Badge variant="warn" className="px-3 py-1 text-sm">{awaiting} notices awaiting approval →</Badge></Link>
          ) : null
        }
      />
      <ErrorNote error={q.error} />
      {q.isPending ? <Skeleton className="h-40 w-full" /> : null}
      {q.data && !q.data.length ? <Empty>No cases yet. Once protection is on, the scan on Home looks for look-alikes of your brand.</Empty> : null}
      {q.data?.length ? (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Case</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead className="text-right">Threats</TableHead>
                <TableHead className="text-right">Notices</TableHead>
                <TableHead className="text-right">Filed</TableHead>
                <TableHead className="text-right">Removed</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link to="/cases/$caseId" params={{ caseId: c.id }}>{c.title}</Link>
                    <div className="font-mono text-xs text-muted-foreground">{c.id}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{fmtTime(c.opened_at)}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.threat_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.notice_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.filed_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.removed_count}</TableCell>
                  <TableCell><StatusChip value={c.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}
    </Page>
  )
}
