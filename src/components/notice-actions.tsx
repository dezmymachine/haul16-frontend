import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { api, type FileMode, type Notice } from '@/api'
import { useApprover } from '@/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

/**
 * The one set of notice actions, used on the Approvals inbox and on the case page:
 * drafted -> approve / reject, approved -> file (dry run), filed -> log first response / removed.
 * The approver is the global "Acting as" name from the top-right account menu.
 */
export function NoticeActions({ n }: { n: Pick<Notice, 'id' | 'case_id' | 'status' | 'method' | 'recipient' | 'recipient_verified'> }) {
  const qc = useQueryClient()
  const [approver] = useApprover()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [byHand, setByHand] = useState(false)
  const [ref, setRef] = useState('')
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, staleTime: 60_000 })
  const who = approver.trim()
  const canAct = who.length >= 2

  const done = (msg: string) => {
    toast.success(msg)
    qc.invalidateQueries({ queryKey: ['case', n.case_id] })
    qc.invalidateQueries({ queryKey: ['cases'] })
    qc.invalidateQueries({ queryKey: ['stats'] })
    qc.invalidateQueries({ queryKey: ['notices'] })
  }
  const fail = (e: Error) => toast.error(e.message)

  const approve = useMutation({ mutationFn: () => api.approve(n.id, who), onSuccess: () => done('Notice approved'), onError: fail })
  const reject = useMutation({
    mutationFn: () => api.reject(n.id, who, reason.trim()),
    onSuccess: () => {
      setRejecting(false)
      setReason('')
      done('Notice rejected')
    },
    onError: fail,
  })
  const file = useMutation({
    mutationFn: ({ mode, reference }: { mode: FileMode; reference?: string }) => api.file(n.id, mode, reference),
    onSuccess: (_r, v) => {
      setByHand(false)
      setRef('')
      done(v.mode === 'dry_run' ? 'Filed (dry run). Nothing was sent. Takedown clock started' : v.mode === 'manual' ? 'Recorded as filed. The takedown clock is running' : 'Sent by email. The takedown clock is running')
    },
    onError: fail,
  })
  const dryRun = health.data?.dry_run ?? true
  const canEmail = !!health.data && !health.data.dry_run && health.data.email_ready && n.method === 'email' && !!n.recipient_verified
  const isFiled = n.status === 'filed_dry_run' || n.status === 'filed'
  const clock = useMutation({
    mutationFn: (ev: 'first_response' | 'removed') => api.clock(n.id, ev, 'Logged by operator (simulated)'),
    onSuccess: () => done('Clock updated'),
    onError: fail,
  })

  return (
    <div className="flex flex-wrap items-center gap-2">
      {n.status === 'drafted' ? (
        <>
          <Button size="sm" disabled={!canAct || approve.isPending} onClick={() => approve.mutate()}>
            Approve
          </Button>
          <Button size="sm" variant="outline" disabled={!canAct} onClick={() => setRejecting(true)}>
            Reject
          </Button>
          {!canAct ? <span className="text-xs text-muted-foreground">Set your approver name in the top-right account menu to approve.</span> : null}
        </>
      ) : null}
      {n.status === 'approved' ? (
        <>
          <Button size="sm" variant={dryRun ? 'default' : 'outline'} disabled={file.isPending} onClick={() => file.mutate({ mode: 'dry_run' })}>
            File (dry run)
          </Button>
          <Button size="sm" variant={dryRun ? 'outline' : 'default'} disabled={file.isPending} onClick={() => setByHand(true)}>
            I filed it myself
          </Button>
          {canEmail ? <Button size="sm" disabled={file.isPending} onClick={() => file.mutate({ mode: 'email' })}>Send by email</Button> : null}
        </>
      ) : null}
      {isFiled ? (
        <>
          <Button size="sm" variant="outline" disabled={clock.isPending} onClick={() => clock.mutate('first_response')}>
            Log first response
          </Button>
          <Button size="sm" disabled={clock.isPending} onClick={() => clock.mutate('removed')}>
            Mark removed
          </Button>
          {n.status === 'filed_dry_run' ? <span className="text-xs text-muted-foreground">Simulated: nothing was sent.</span> : <span className="text-xs text-muted-foreground">Real: logged against your actual filing.</span>}
        </>
      ) : null}

      <Dialog open={byHand} onOpenChange={setByHand}>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); file.mutate({ mode: 'manual', reference: ref.trim() || undefined }) }} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Record that you filed it</DialogTitle>
              <DialogDescription>
                Send the notice yourself, then record it here to start a real takedown clock. Download the evidence pack from the notice for the form or email.
              </DialogDescription>
            </DialogHeader>
            {n.method !== 'email' && n.recipient.startsWith('http') ? (
              <Button type="button" variant="outline" asChild className="justify-self-start"><a href={n.recipient} target="_blank" rel="noreferrer"><ExternalLink /> Open the recipient's form</a></Button>
            ) : <p className="text-sm text-muted-foreground">Recipient: <span className="font-mono">{n.recipient}</span></p>}
            <div className="grid gap-2">
              <Label htmlFor={`ref-${n.id}`}>Reference <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id={`ref-${n.id}`} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Ticket number, or where you filed it" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setByHand(false)}>Cancel</Button>
              <Button type="submit" disabled={file.isPending}>I filed it</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              reject.mutate()
            }}
            className="grid gap-4"
          >
            <DialogHeader>
              <DialogTitle>Reject this notice</DialogTitle>
              <DialogDescription>The reason is kept in the audit log with your name.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor={`reason-${n.id}`}>Reason</Label>
              <Input
                id={`reason-${n.id}`}
                placeholder="e.g. legitimate reseller"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                minLength={3}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejecting(false)}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={reject.isPending}>Reject notice</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
