import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/api'
import { useBrands } from '@/brand'
import { ErrorNote } from '@/ui'
import { Page } from '@/components/page'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export const Route = createFileRoute('/brands/new')({ component: NewBrandPage })

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)

function NewBrandPage() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const { select } = useBrands()
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [socials, setSocials] = useState('')
  const [domains, setDomains] = useState('')

  const create = useMutation({
    mutationFn: async () => {
      const b = await api.brandCreate({
        display_name: name.trim(), website: website.trim() || undefined, linkedin_url: linkedin.trim() || undefined,
        socials: lines(socials), extra_domains: lines(domains),
      })
      await api.profileRun(b.id)
      return b
    },
    onSuccess: async (b) => {
      await qc.invalidateQueries({ queryKey: ['brands'] })
      select(b.id)
      toast.success('Brand added. Building its profile now.')
      nav({ to: '/brands/$brandId', params: { brandId: b.id } })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Page crumbs={[{ label: 'Insights' }, { label: 'Brand', to: '/brand' }, { label: 'Add a brand' }]}>
      <PageHeader
        title="Add a brand"
        description="Tell HAUL16 who the brand is. It reads the brand's own public footprint (website, DNS, registrar, logos, socials, press) and builds a sourced identity profile that detection then matches against."
      />
      <form
        className="grid max-w-2xl gap-6"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate()
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>The brand</CardTitle>
            <CardDescription>Only things the organisation itself publishes. You confirm anything sensitive before it is used.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="b-name">Brand name</Label>
              <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Pay" required minLength={2} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="b-site">Website</Label>
              <Input id="b-site" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acmepay.com" />
              <p className="text-xs text-muted-foreground">Its domain becomes the first official domain. You will prove you control it on the next screen.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="b-li">LinkedIn company page</Label>
              <Input id="b-li" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://www.linkedin.com/company/acme-pay" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="b-soc">Other official accounts</Label>
              <Textarea id="b-soc" value={socials} onChange={(e) => setSocials(e.target.value)} rows={3} placeholder={'https://x.com/acmepay\nhttps://t.me/acmepay'} />
              <p className="text-xs text-muted-foreground">One link per line: X, Facebook, Instagram, TikTok, YouTube, Telegram, WhatsApp channel.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="b-dom">Other official domains</Label>
              <Textarea id="b-dom" value={domains} onChange={(e) => setDomains(e.target.value)} rows={2} placeholder="acmepay.com.gh" />
            </div>
          </CardContent>
        </Card>
        <ErrorNote error={create.error} />
        <div className="flex gap-3">
          <Button type="submit" size="lg" disabled={create.isPending || name.trim().length < 2 || !(website.trim() || linkedin.trim())}>
            {create.isPending ? 'Adding…' : 'Add brand and build profile'}
          </Button>
        </div>
      </form>
    </Page>
  )
}
