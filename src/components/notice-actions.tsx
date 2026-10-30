import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, type Notice } from '@/api'
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
export function NoticeActions({ n }: { n: Pick<Notice, 'id' | 'case_id' | 'status'> }) {
  const qc = useQueryClient()
  const [approver] = useApprover()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
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
  const file = useMutation({ mutationFn: () => api.file(n.id), onSuccess: () => done('Filed (dry run). Takedown clock started'), onError: fail })
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
        <Button size="sm" disabled={file.isPending} onClick={() => file.mutate()}>
          File (dry run) and start clock
        </Button>
      ) : null}
      {n.status === 'filed_dry_run' ? (
        <>
          <Button size="sm" variant="outline" disabled={clock.isPending} onClick={() => clock.mutate('first_response')}>
            Log first response
          </Button>
          <Button size="sm" disabled={clock.isPending} onClick={() => clock.mutate('removed')}>
            Mark removed
          </Button>
          <span className="text-xs text-muted-foreground">Simulated while HAUL16 runs dry.</span>
        </>
      ) : null}

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
