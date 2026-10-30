import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { FolderOpen } from 'lucide-react'
import { api } from '@/api'
import { ErrorNote, fmtTime } from '@/ui'
import { Page } from '@/components/page'
import { PageHeader } from '@/components/page-header'
import { ThreatEvidence } from '@/components/threat-evidence'
import { WorkflowStepper, threatReached } from '@/components/workflow-stepper'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/threats/$threatId')({ component: ThreatPage })

function ThreatPage() {
  const { threatId } = Route.useParams()
  const q = useQuery({ queryKey: ['threat', threatId], queryFn: () => api.threat(threatId) })
  const t = q.data
  return (
    <Page crumbs={[{ label: 'Threats', to: '/threats' }, { label: t?.hostname ?? threatId }]}>
      <ErrorNote error={q.error} />
      {!t && !q.error ? <Skeleton className="h-64 w-full" /> : null}
      {t ? (
        <>
          <PageHeader
            mono
            title={t.hostname}
            description={
              <>
                Detected {fmtTime(t.detected_at)} via {t.source.replaceAll('_', ' ')}
                {t.source_ref ? <> (<span className="font-mono text-xs">{t.source_ref}</span>)</> : null}
              </>
            }
            actions={
              t.case_id ? (
                <Button asChild>
                  <Link to="/cases/$caseId" params={{ caseId: t.case_id }}><FolderOpen /> Open case {t.case_id}</Link>
                </Button>
              ) : null
            }
          />
          <WorkflowStepper reached={threatReached(t)} />
          <Card>
            <CardContent><ThreatEvidence t={t} /></CardContent>
          </Card>
          {!t.case_id ? (
            <p className="text-sm text-muted-foreground">
              No case yet. A case opens when a capture scores medium or high, after which takedown notices are drafted for approval.
            </p>
          ) : null}
        </>
      ) : null}
    </Page>
  )
}
