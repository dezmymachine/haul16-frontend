import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import { ErrorNote, Hash, Mono } from '@/ui'
import { Page } from '@/components/page'
import { PageHeader } from '@/components/page-header'
import { KV } from '@/components/threat-evidence'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/brand')({ component: BrandPage })

function List({ items }: { items?: (string | number)[] }) {
  if (!items?.length) return <span className="text-sm text-muted-foreground">none registered</span>
  return (
    <ul className="grid gap-1">
      {items.map((i) => (
        <li key={String(i)}><Mono>{i}</Mono></li>
      ))}
    </ul>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="grid gap-3">{children}</CardContent>
    </Card>
  )
}

function Sub({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</div>
}

function BrandPage() {
  const q = useQuery({ queryKey: ['brand'], queryFn: api.brand })
  const b = q.data
  return (
    <Page crumbs={[{ label: 'Insights' }, { label: 'Brand' }]}>
      <PageHeader
        title={b?.display_name ?? 'Brand'}
        description={
          <>
            The official asset register. Every detection is a difference from this list: a page that uses the brand with a number or wallet
            not listed here is the strongest clone signal. Edit <Mono>backend/brand.yaml</Mono> and restart the API to change it.
          </>
        }
      />
      {b?.fictional ? (
        <Alert><AlertDescription>Fictional demo brand. Not a real company.</AlertDescription></Alert>
      ) : null}
      <ErrorNote error={q.error} />
      {q.isPending ? <Skeleton className="h-64 w-full" /> : null}
      {b ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Section title="Names watched for"><List items={b.seed_terms} /></Section>
          <Section title="Domains">
            <Sub>Official</Sub><List items={b.official_domains} />
            <Sub>Allowlisted partners</Sub><List items={b.allowlist_domains} />
          </Section>
          <Section title="Payment identifiers">
            <Sub>Official numbers</Sub><List items={b.official_numbers} />
            <Sub>Official wallets</Sub><List items={b.official_wallets} />
          </Section>
          <Section title="Official handles">
            <List items={Object.entries(b.official_handles ?? {}).map(([k, v]) => `${k}: ${v}`)} />
          </Section>
          <Section title="Favicon fingerprints"><List items={b.official_favicon_mmh3} /></Section>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Authorisation letter</CardTitle>
              <CardDescription>Appoints HAUL16 as authorised agent. Its hash travels with every notice.</CardDescription>
            </CardHeader>
            <CardContent>
              <KV rows={[['File', <Mono>{b.authorisation_letter.ref}</Mono>], ['SHA-256', <Hash value={b.authorisation_letter.sha256} />]]} />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </Page>
  )
}
