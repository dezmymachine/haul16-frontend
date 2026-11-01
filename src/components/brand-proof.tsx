import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, FileCheck2, ShieldCheck, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api'
import { Hash, Mono } from '@/ui'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function copy(text: string) {
  void navigator.clipboard?.writeText(text).then(() => toast.success('Copied'))
}

/** Proof that whoever set the brand up controls its domain: a DNS TXT record, checked on demand. */
export function OwnershipCard({ brandId }: { brandId: string }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['brand-setup', brandId], queryFn: () => api.brandGet(brandId), refetchInterval: 5000 })
  const b = q.data
  const verify = useMutation({
    mutationFn: () => api.brandVerify(brandId),
    onSuccess: (r) => {
      if (r.verified) toast.success('Ownership verified')
      else toast.error(r.reason ?? 'Not verified yet')
      qc.invalidateQueries({ queryKey: ['brand-setup', brandId] })
      qc.invalidateQueries({ queryKey: ['setup', brandId] })
      qc.invalidateQueries({ queryKey: ['brands'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  if (!b) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5" /> Prove you control {b.verification.domain ?? 'the domain'}</CardTitle>
        <CardDescription>Add this DNS record where your domain is managed, then check. It can take a few minutes to appear.</CardDescription>
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
              {[['Type', b.verification.record_type], ['Name', b.verification.record_name], ['Value', b.verification.record_value]].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3 rounded-md border bg-muted/50 px-3 py-2">
                  <div className="min-w-0"><dt className="text-xs text-muted-foreground">{k}</dt><dd><Mono>{v}</Mono></dd></div>
                  <Button size="icon" variant="ghost" aria-label={`Copy ${k}`} onClick={() => copy(v)}><Copy /></Button>
                </div>
              ))}
            </dl>
            <Button className="justify-self-start" disabled={verify.isPending} onClick={() => verify.mutate()}>{verify.isPending ? 'Checking…' : 'Check now'}</Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">This brand has no website, so there is no domain to verify.</p>
        )}
      </CardContent>
    </Card>
  )
}

/** The signed letter appointing HAUL16 as the brand's agent. Stored by SHA-256; the hash goes on every notice. */
export function LetterCard({ brandId }: { brandId: string }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const q = useQuery({ queryKey: ['brand-setup', brandId], queryFn: () => api.brandGet(brandId), refetchInterval: 5000 })
  const b = q.data
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
      qc.invalidateQueries({ queryKey: ['setup', brandId] })
      qc.invalidateQueries({ queryKey: ['brands'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  if (!b) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileCheck2 className="size-5" /> Authorisation letter</CardTitle>
        <CardDescription>The signed letter appointing HAUL16 as your designated agent. Its fingerprint (SHA-256) is printed on every notice.</CardDescription>
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
  )
}
