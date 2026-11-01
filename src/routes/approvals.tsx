import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api, type NoticeStatus } from '@/api'
import { Empty, ErrorNote, useApprover } from '@/ui'
import { Page } from '@/components/page'
import { PageHeader } from '@/components/page-header'
import { NoticeCard } from '@/components/notice-card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const TABS: { value: NoticeStatus; label: string; empty: string }[] = [
  { value: 'drafted', label: 'Awaiting approval', empty: 'Nothing waiting. New notices are drafted automatically when a case opens.' },
  { value: 'approved', label: 'Ready to file', empty: 'No approved notices waiting to be filed.' },
  { value: 'filed_dry_run', label: 'Filed', empty: 'Nothing filed yet. Approve a notice, then file it to start the takedown clock.' },
  { value: 'rejected', label: 'Rejected', empty: 'No rejected notices.' },
]

export const Route = createFileRoute('/approvals')({
  validateSearch: (s: Record<string, unknown>): { status?: NoticeStatus } => ({
    status: TABS.some((t) => t.value === s.status) ? (s.status as NoticeStatus) : undefined,
  }),
  component: ApprovalsPage,
})

function ApprovalsPage() {
  const { status = 'drafted' } = Route.useSearch()
  const navigate = Route.useNavigate()
  const [approver] = useApprover()
  const q = useQuery({ queryKey: ['notices'], queryFn: () => api.notices(), refetchInterval: 15_000 })
  const all = q.data ?? []
  const isIn = (n: { status: NoticeStatus }, s: NoticeStatus) => (s === 'filed_dry_run' ? n.status === 'filed_dry_run' || n.status === 'filed' : n.status === s)
  const count = (s: NoticeStatus) => all.filter((n) => isIn(n, s)).length
  const current = TABS.find((t) => t.value === status)!
  const rows = all.filter((n) => isIn(n, status))

  return (
    <Page crumbs={[{ label: 'Respond' }, { label: 'Approvals' }]}>
      <PageHeader
        title="Approvals"
        description="Step 4: every takedown notice needs a named person to approve it before it can be filed. Approve, file (dry run) and the takedown clock starts on the case."
      />
      {approver.trim().length < 2 ? (
        <Alert>
          <AlertTitle>Set who you are</AlertTitle>
          <AlertDescription>Enter your name under “Acting as” in the account menu at the top right. It is recorded on every approval in the audit log.</AlertDescription>
        </Alert>
      ) : null}
      <Tabs value={status} onValueChange={(v) => navigate({ search: { status: v as NoticeStatus }, replace: true })}>
        <div className="max-w-full overflow-x-auto">
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
              <Badge variant={t.value === 'drafted' && count('drafted') ? 'warn' : 'secondary'} className="ml-1.5">{count(t.value)}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
        </div>
      </Tabs>
      <ErrorNote error={q.error} />
      {q.isPending ? <Skeleton className="h-48 w-full" /> : null}
      {q.data && !rows.length ? <Empty>{current.empty}</Empty> : null}
      <div className="grid gap-4">
        {rows.map((n) => (
          <NoticeCard key={n.id} n={n} host={n.host} caseLink={{ id: n.case_id, title: n.case_title }} />
        ))}
      </div>
    </Page>
  )
}
