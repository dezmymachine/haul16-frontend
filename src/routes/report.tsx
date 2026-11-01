import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Download, Printer } from 'lucide-react'
import { api } from '@/api'
import { CHANNEL_LABEL, Empty, ErrorNote, Stat, StatusChip, fmtTime } from '@/ui'
import { Page } from '@/components/page'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export const Route = createFileRoute('/report')({ component: ReportPage })

const thisMonth = () => new Date().toISOString().slice(0, 7)

function minutes(m: number | null) {
  if (m == null) return '—'
  if (m < 60) return `${m.toFixed(0)} min`
  if (m < 60 * 48) return `${(m / 60).toFixed(1)} h`
  return `${(m / 1440).toFixed(1)} d`
}

function ReportPage() {
  const [month, setMonth] = useState(thisMonth())
  const q = useQuery({ queryKey: ['report', month], queryFn: () => api.report(month) })
  const r = q.data

  const download = () => {
    if (!r) return
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `haul16-report-${r.month}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <Page crumbs={[{ label: 'Insights' }, { label: 'Report' }]}>
      <PageHeader
        title={`${r?.brand ?? 'Report'} · ${month}`}
        description="Step 7: the monthly brand protection report, for the compliance lead to hand to the regulator or bank partner."
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <Label htmlFor="month" className="sr-only">Month</Label>
            <Input id="month" type="month" className="w-40" value={month} onChange={(e) => setMonth(e.target.value || thisMonth())} />
            <Button variant="outline" onClick={() => window.print()}><Printer /> Print</Button>
            <Button onClick={download} disabled={!r}><Download /> Export JSON</Button>
          </div>
        }
      />
      <ErrorNote error={q.error} />
      {q.isPending ? <Skeleton className="h-64 w-full" /> : null}
      {r ? (
        <>
          <Alert>
            <AlertDescription>DRY RUN · {r.limitations.join(' ')}</AlertDescription>
          </Alert>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Threats detected" value={r.threats_detected}
              sub={Object.entries(r.threats_by_confidence).map(([k, v]) => `${v} ${k}`).join(' · ') || 'none'} />
            <Stat label="Cases opened" value={r.cases_opened} />
            <Stat label="Notices filed" value={r.notices.filed_dry_run + (r.notices.filed ?? 0)} sub={`${r.notices.approved} approved, not yet filed`} />
            <Stat label="Rejected by reviewer" value={r.notices.rejected} />
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Time to removal by channel</CardTitle>
              <CardDescription>The headline number. Measured, never claimed. Median over removals logged this month.</CardDescription>
            </CardHeader>
            <CardContent>
              {r.channels.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Channel</TableHead>
                      <TableHead className="text-right">Filed</TableHead>
                      <TableHead className="text-right">Responded</TableHead>
                      <TableHead className="text-right">Removed</TableHead>
                      <TableHead className="text-right">Median detect → removed</TableHead>
                      <TableHead className="text-right">Median filed → removed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.channels.map((ch) => (
                      <TableRow key={ch.channel}>
                        <TableCell>{CHANNEL_LABEL[ch.channel] ?? ch.channel}</TableCell>
                        <TableCell className="text-right tabular-nums">{ch.filed}</TableCell>
                        <TableCell className="text-right tabular-nums">{ch.first_response}</TableCell>
                        <TableCell className="text-right tabular-nums">{ch.removed}</TableCell>
                        <TableCell className="text-right tabular-nums">{minutes(ch.median_detect_to_removed_min)}</TableCell>
                        <TableCell className="text-right tabular-nums">{minutes(ch.median_file_to_removed_min)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Empty>No notices filed this month.</Empty>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Cases</CardTitle></CardHeader>
            <CardContent>
              {r.cases.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Case</TableHead><TableHead>Opened</TableHead>
                      <TableHead className="text-right">Threats</TableHead><TableHead className="text-right">Filed</TableHead>
                      <TableHead className="text-right">Removed</TableHead><TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.cases.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell><Link to="/cases/$caseId" params={{ caseId: c.id }} className="font-mono text-xs">{c.id}</Link></TableCell>
                        <TableCell className="text-xs">{fmtTime(c.opened_at)}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.threats}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.filed}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.removed}</TableCell>
                        <TableCell><StatusChip value={c.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Empty>No cases opened this month.</Empty>
              )}
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">Generated {fmtTime(r.generated_at)} by HAUL16.</p>
        </>
      ) : null}
    </Page>
  )
}
