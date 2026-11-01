import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, KeyRound, Mail, Webhook } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api'
import { useBrands } from '@/brand'
import { Mono } from '@/ui'
import { Page } from '@/components/page'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'

export const Route = createFileRoute('/settings')({ component: SettingsPage })

const HOURS = [['0', 'Off (only when I press Scan)'], ['1', 'Every hour'], ['6', 'Every 6 hours'], ['12', 'Every 12 hours'], ['24', 'Every day'], ['72', 'Every 3 days']]

function SettingsPage() {
  const qc = useQueryClient()
  const { current } = useBrands()
  const sources = useQuery({ queryKey: ['sources'], queryFn: api.sources })
  const health = useQuery({ queryKey: ['health'], queryFn: api.health })
  const setup = useQuery({ queryKey: ['setup', current?.id], queryFn: () => api.setup(current!.id), enabled: !!current })
  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.sourceToggle(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sources'] }),
    onError: (e: Error) => toast.error(e.message),
  })
  const patrol = useMutation({
    mutationFn: (hours: number) => api.brandPatch(current!.id, { patrol_hours: hours }),
    onSuccess: () => {
      toast.success('Scan schedule saved')
      qc.invalidateQueries({ queryKey: ['setup'] })
      qc.invalidateQueries({ queryKey: ['brands'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const test = useMutation({
    mutationFn: api.alertTest,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['alerts'] })
      const sent = Object.entries(r.delivered)
      if (!sent.length) toast.message('Test alert added to the bell. No email or webhook is set up yet.')
      else sent.forEach(([ch, res]) => (res === 'sent' ? toast.success(`Sent to ${ch}`) : toast.error(`${ch}: ${res}`)))
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const h = health.data
  const hours = String(current?.patrol_hours ?? setup.data?.patrol?.hours ?? 6)
  const nextAt = setup.data?.patrol?.next_at

  return (
    <Page crumbs={[{ label: 'Insights' }, { label: 'Settings' }]}>
      <PageHeader title="Settings" description="Where HAUL16 looks, how often, and how it gets your attention." />

      <Card>
        <CardHeader>
          <CardTitle>Scans</CardTitle>
          <CardDescription>HAUL16 scans for look-alikes on a schedule, so protection continues without you pressing anything.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {current ? (
            <div className="grid max-w-md gap-2">
              <label className="text-sm font-medium" htmlFor="patrol">Scan {current.display_name}</label>
              <Select value={hours} onValueChange={(v) => patrol.mutate(Number(v))}>
                <SelectTrigger id="patrol"><SelectValue /></SelectTrigger>
                <SelectContent>{HOURS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{nextAt && hours !== '0' ? `Next scan: ${new Date(nextAt).toLocaleString()}` : hours === '0' ? 'Scheduled scans are off.' : 'Starts once protection is on.'}</p>
            </div>
          ) : null}
          <div className="grid gap-1">
            <div className="text-sm font-medium">Where it looks</div>
            {sources.isPending ? <Skeleton className="h-40 w-full" /> : (
              <ul className="rounded-md border">
                {sources.data?.map((s) => (
                  <li key={s.id} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 font-medium">
                        {s.label}
                        {s.needs_key ? (s.configured ? <Badge variant="ok"><Check /> key set</Badge> : <Badge variant="warn"><KeyRound /> needs <Mono className="text-[0.85em]">{s.needs_key}</Mono></Badge>) : <Badge variant="secondary">no key needed</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">{s.description}</div>
                    </div>
                    <Switch checked={s.enabled} aria-label={`Use ${s.label}`} onCheckedChange={(v) => toggle.mutate({ id: s.id, enabled: v })} />
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">A source that needs a key is skipped, with the reason shown after each scan, until its key is set on the server.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="size-5" /> Alerts</CardTitle>
          <CardDescription>Medium and high findings, confirmed takedowns and scans that found something. The bell in the top bar always works.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ul className="grid gap-2 text-sm">
            <li className="flex items-center gap-3"><Bell className="size-4" /> In the app <Badge variant="ok">on</Badge></li>
            <li className="flex items-center gap-3"><Mail className="size-4" /> Email {h?.alert_channels?.email ? <Badge variant="ok">on</Badge> : <Badge variant="secondary">off</Badge>}
              {!h?.alert_channels?.email ? <span className="text-muted-foreground">set <Mono>SMTP_HOST</Mono> and <Mono>ALERT_EMAIL_TO</Mono> on the server</span> : null}</li>
            <li className="flex items-center gap-3"><Webhook className="size-4" /> Slack or webhook {h?.alert_channels?.webhook ? <Badge variant="ok">on</Badge> : <Badge variant="secondary">off</Badge>}
              {!h?.alert_channels?.webhook ? <span className="text-muted-foreground">set <Mono>ALERT_WEBHOOK_URL</Mono> on the server</span> : null}</li>
          </ul>
          <Button variant="outline" className="justify-self-start" disabled={test.isPending} onClick={() => test.mutate()}>{test.isPending ? 'Sending…' : 'Send a test alert'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filing</CardTitle>
          <CardDescription>How approved notices leave HAUL16.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {h?.dry_run ? (
            <Alert><AlertTitle>Dry run is on</AlertTitle><AlertDescription>HAUL16 will not send anything itself. You can still file a notice on the recipient’s own site and record it here (“I filed it myself”), which starts a real takedown clock, and download an evidence pack for any notice. Set <Mono>HAUL16_DRY_RUN=0</Mono> on the server to allow sending by email.</AlertDescription></Alert>
          ) : (
            <Alert><AlertTitle>Sending is on</AlertTitle><AlertDescription>Notices can be sent by email from HAUL16 when the channel is an email address, its recipient is verified and email is set up. Email {h?.email_ready ? 'is ready.' : <>is not set up: add <Mono>SMTP_HOST</Mono> on the server.</>}</AlertDescription></Alert>
          )}
          <p className="text-muted-foreground">Every filing needs a verified domain and an authorisation letter on file. Taken-down sites are detected automatically for notices that were really filed.</p>
        </CardContent>
      </Card>
    </Page>
  )
}
