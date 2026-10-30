import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import type { Notice } from '@/api'
import { CHANNEL_LABEL, Mono, StatusChip, fmtTime } from '@/ui'
import { NoticeActions } from '@/components/notice-actions'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

/** One takedown notice: recipient, subject, readable text, evidence hashes and the next action. */
export function NoticeCard({ n, host, caseLink }: { n: Notice; host?: string | null; caseLink?: { id: string; title: string } }) {
  return (
    <Card className={'gap-3 py-4'}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 px-4 max-sm:flex-col-reverse">
        <div className="grid min-w-0 gap-1 [overflow-wrap:anywhere]">
          <div className="font-medium">
            {CHANNEL_LABEL[n.channel] ?? n.channel_name}
            {host ? <span className="font-mono text-xs text-muted-foreground"> · {host}</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{n.method === 'email' ? 'Email to' : 'Submit at'}</span>
            <Mono>{n.recipient}</Mono>
            {n.recipient_verified ? <Badge variant="ok">verified channel</Badge> : <Badge variant="warn">unverified channel</Badge>}
          </div>
          {caseLink ? (
            <Link to="/cases/$caseId" params={{ caseId: caseLink.id }} search={{ tab: 'notices' }} className="text-xs">
              Case: {caseLink.title}
            </Link>
          ) : null}
        </div>
        <StatusChip value={n.status} />
      </CardHeader>
      <CardContent className="grid gap-2 px-4">
        <div className="text-sm font-medium">{n.subject}</div>
        <Collapsible>
          <CollapsibleTrigger className="group flex items-center gap-1 text-sm text-primary">
            <ChevronRight className="size-4 transition-transform group-data-[state=open]:rotate-90" /> Read notice text
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 max-h-80 overflow-auto rounded-md border bg-muted/50 p-3 font-sans text-sm whitespace-pre-wrap">{n.body}</pre>
          </CollapsibleContent>
        </Collapsible>
        <div className="text-xs text-muted-foreground">
          Evidence: page <Mono>{n.evidence_refs.html_sha256?.slice(0, 12)}</Mono> · screenshot{' '}
          <Mono>{n.evidence_refs.screenshot_sha256?.slice(0, 12)}</Mono> · letter <Mono>{n.evidence_refs.letter_sha256?.slice(0, 12)}</Mono>
          {n.approved_by ? (
            <> · {n.status === 'rejected' ? 'rejected' : 'approved'} by <strong>{n.approved_by}</strong> {fmtTime(n.approved_at)}</>
          ) : null}
        </div>
      </CardContent>
      <CardFooter className="px-4">
        <NoticeActions n={n} />
      </CardFooter>
    </Card>
  )
}
