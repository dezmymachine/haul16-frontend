import { useRef } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, FileCheck2, ShieldCheck, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api'
import { useBrands } from '@/brand'
import { ErrorNote, Hash, Mono } from '@/ui'
import { Page } from '@/components/page'
import { PageHeader } from '@/components/page-header'
import { ProfileSteps } from '@/components/profile-steps'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/brands/$brandId')({ component: SetupPage })

function copy(text: string) {
  void navigator.clipboard?.writeText(text).then(() => toast.success('Copied'))
}

function SetupPage() {
  const { brandId } = Route.useParams()
  const qc = useQueryClient()
  const nav = useNavigate()
  const { select } = useBrands()
  const brand = useQuery({ queryKey: ['brand-setup', brandId], queryFn: () => api.brandGet(brandId), refetchInterval: 4000 })
  const status = useQuery({
    queryKey: ['profile-status', brandId],
    queryFn: () => api.profileStatus(brandId),
    refetchInterval: (q) => (q.state.data && ['done', 'failed'].includes(q.state.data.status) ? false : 1500),
  })
  const b = brand.data
  const job = status.data
  const running = !job || job.status === 'queued' || job.status === 'running'

  const verify = useMutation({
    mutationFn: () => api.brandVerify(brandId),
    onSuccess: (r) => {
      if (r.verified) toast.success('Ownership verified')
      else toast.error(r.reason ?? 'Not verified yet')
      qc.invalidateQueries({ queryKey: ['brand-setup', brandId] })
      qc.invalidateQueries({ queryKey: ['brands'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const rerun = useMutation({
    mutationFn: () => api.profileRun(brandId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-status', brandId] }),
  })
  const fileRef = useRef<HTMLInputElement>(null)
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const buf = new Uint8Array(await file.arrayBuffer())
      let bin = ''
      buf.forEach((x) => (bin += String.fromCharCode(x)))
      return api.letterUpload(brandId, file.name, btoa(bin))
    },
    onSuccess: () => {
      toast.success('Authorisation letter stored')
      qc.invalidateQueries({ queryKey: ['brand-setup', brandId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Page crumbs={[{ label: 'Brand', to: '/brand' }, { label: b?.display_name ?? 'Setup' }]}>
      <PageHeader
        title={b ? `Setting up ${b.display_name}` : 'Setting up'}
        description="HAUL16 is building the brand's profile. While it runs, prove you control the brand and add the signed authorisation letter. No filing is possible without both."
        actions={
          <Button
            disabled={running || job?.status === 'failed'}
            onClick={() => {
              select(brandId)
              nav({ to: '/brand' })
            }}
          >
            Open the profile
          </Button>
        }
      />
      {brand.error ? <ErrorNote error={brand.error} /> : null}
      {!b ? <Skeleton className="h-64 w-full" /> : null}
      {b ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="lg:row-span-2">
            <CardHeader>
              <CardTitle>Building the profile</CardTitle>
              <CardDescription>
                {job?.status === 'done' ? 'Finished. Review what it found in the profile.' : job?.status === 'failed' ? 'It failed. See the error below and try again.' : 'Each step reads public sources. Steps without an API key are skipped, not failed.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {job && Object.keys(job.steps).length ? <ProfileSteps steps={job.steps} /> : <Skeleton className="h-48 w-full" />}
              {job?.status === 'failed' ? <Alert variant="destructive"><AlertDescription>{job.error}</AlertDescription></Alert> : null}
              {!running ? (
                <Button variant="outline" className="justify-self-start" disabled={rerun.isPending} onClick={() => rerun.mutate()}>Run it again</Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5" /> Prove you control {b.verification.domain ?? 'the domain'}</CardTitle>
              <CardDescription>Add this DNS record at your domain provider, then check. It can take a few minutes to appear.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {b.ownership_status === 'verified' ? (
                <Alert>
                  <AlertTitle>Ownership verified</AlertTitle>
                  <AlertDescription>{b.verified_at ? `Confirmed ${new Date(b.verified_at).toLocaleString()}.` : null}</AlertDescription>
                </Alert>
              ) : b.verification.record_name ? (
                <>
                  <dl className="grid gap-2 text-sm">
                    {[
                      ['Type', b.verification.record_type],
                      ['Name', b.verification.record_name],
                      ['Value', b.verification.record_value],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-3 rounded-md border bg-muted/50 px-3 py-2">
                        <div className="min-w-0"><dt className="text-xs text-muted-foreground">{k}</dt><dd><Mono>{v}</Mono></dd></div>
                        <Button size="icon" variant="ghost" aria-label={`Copy ${k}`} onClick={() => copy(v)}><Copy /></Button>
                      </div>
                    ))}
                  </dl>
                  <Button className="justify-self-start" disabled={verify.isPending} onClick={() => verify.mutate()}>{verify.isPending ? 'Checking…' : 'Check now'}</Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Add a website to the brand to verify ownership.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileCheck2 className="size-5" /> Authorisation letter</CardTitle>
              <CardDescription>The signed letter appointing HAUL16 as the brand's designated agent. Its SHA-256 goes into every notice.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {b.authorisation_letter_sha256 ? (
                <div className="grid gap-1 text-sm">
                  <div><span className="text-muted-foreground">File </span><Mono>{b.authorisation_letter_ref}</Mono></div>
                  <div><span className="text-muted-foreground">SHA-256 </span><Hash value={b.authorisation_letter_sha256} /></div>
                </div>
              ) : (
                <Badge variant="warn" className="w-fit">No letter on file</Badge>
              )}
              <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" hidden onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
              <Button variant="outline" className="justify-self-start" disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
                <Upload /> {b.authorisation_letter_sha256 ? 'Replace the letter' : 'Upload the letter'}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Already set up? <Link to="/brand">Go to the profile</Link>.
      </p>
    </Page>
  )
}
