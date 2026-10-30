// Generated "captured page" screenshots for the demo data. Pure SVG data URIs, no network, no image files.
// Every site shown is fictional. The page text mirrors the fixture sites in the backend repo.

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

type Look = { bg: string; accent: string; headline: string; sub: string; cta: string; phone?: string }

function lookFor(host: string): Look {
  if (host.includes('blog'))
    return { bg: '#f4f1ea', accent: '#475569', headline: 'Notes from a Nkwa Exchange user', sub: 'A fan blog about local crypto exchanges. No payments.', cta: 'Read more' }
  if (host.includes('farms'))
    return { bg: '#ecf6e9', accent: '#2f7d32', headline: 'Nkwa Farms: fresh produce, Kumasi', sub: 'Order tomatoes, plantain and yam. Delivery in Kumasi.', cta: 'Order now' }
  if (host.includes('airdrop'))
    return { bg: '#fff4e5', accent: '#c2410c', headline: 'Nkwa Exchange airdrop: claim 500 USDT', sub: 'Limited time bonus. Send a small activation deposit to receive your airdrop.', cta: 'Claim airdrop', phone: '024 000 0101' }
  if (host.includes('wallet'))
    return { bg: '#eef2ff', accent: '#4338ca', headline: 'Verify your Nkwa wallet', sub: 'Your account is limited. Verify your wallet within 24 hours to avoid suspension.', cta: 'Verify wallet', phone: '020 077 1234' }
  return { bg: '#eaf2ff', accent: '#1d4ed8', headline: 'Nkwa Exchange Customer Support Desk', sub: 'Double your USDT. Guaranteed returns. Send your deposit to activate your account.', cta: 'Deposit now', phone: host.includes('gh.xyz') || host.includes('login') ? '024 555 0142' : '024 000 0101' }
}

/** A small browser-window picture of a (fictional) captured page. */
export function demoScreenshot(host: string): string {
  const l = lookFor(host)
  // Break the headline at a word boundary so it stays inside the left half of the page.
  const words = l.headline.split(' ')
  let first = ''
  while (words.length && (first + ' ' + words[0]).trim().length <= 26) first = (first + ' ' + words.shift()).trim()
  const lines = [first, words.join(' ')]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" font-family="Arial, Helvetica, sans-serif">
<rect width="800" height="450" fill="#ffffff"/>
<rect width="800" height="38" fill="#e9eaf0"/>
<circle cx="18" cy="19" r="5" fill="#ff5f57"/><circle cx="36" cy="19" r="5" fill="#febc2e"/><circle cx="54" cy="19" r="5" fill="#28c840"/>
<rect x="80" y="8" width="520" height="22" rx="6" fill="#ffffff"/>
<text x="94" y="24" font-size="12" fill="#475569">https://${esc(host)}/</text>
<rect y="38" width="800" height="412" fill="${l.bg}"/>
<rect y="38" width="800" height="54" fill="${l.accent}"/>
<text x="28" y="72" font-size="20" font-weight="700" fill="#ffffff">${esc(host.includes('farms') ? 'Nkwa Farms' : 'Nkwa Exchange')}</text>
<text x="560" y="70" font-size="13" fill="#ffffff" opacity="0.85">Home    Markets    Support</text>
<text x="48" y="186" font-size="30" font-weight="700" fill="#0f172a">${esc(lines[0])}</text>
<text x="48" y="224" font-size="30" font-weight="700" fill="#0f172a">${esc(lines[1])}</text>
<text x="48" y="272" font-size="15" fill="#334155">${esc(l.sub.length > 70 ? l.sub.slice(0, 70) + '…' : l.sub)}</text>
<rect x="48" y="304" width="190" height="48" rx="8" fill="${l.accent}"/>
<text x="143" y="334" font-size="17" font-weight="700" fill="#ffffff" text-anchor="middle">${esc(l.cta)}</text>
${l.phone ? `<text x="48" y="392" font-size="15" fill="#0f172a">Pay via MoMo: <tspan font-weight="700">${esc(l.phone)}</tspan></text>` : ''}
<rect x="540" y="130" width="212" height="230" rx="14" fill="#ffffff" opacity="0.85"/>
<rect x="560" y="156" width="172" height="14" rx="4" fill="${l.accent}" opacity="0.5"/>
<rect x="560" y="186" width="130" height="10" rx="4" fill="#cbd5e1"/>
<rect x="560" y="210" width="150" height="10" rx="4" fill="#cbd5e1"/>
<rect x="560" y="234" width="110" height="10" rx="4" fill="#cbd5e1"/>
<rect x="560" y="300" width="172" height="36" rx="8" fill="${l.accent}" opacity="0.85"/>
</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
