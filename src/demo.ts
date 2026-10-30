// Decides, once per page load, whether to serve the built-in sample data instead of the real backend.
//   VITE_DEMO_DATA=1  always use sample data (for example a static Vercel deploy with no API)
//   VITE_DEMO_DATA=0  never use it
//   unset             probe /api/health: a JSON {ok:true} means a real backend, anything else (404, HTML, network error) means sample data
let decision: Promise<boolean> | undefined

async function decide(): Promise<boolean> {
  const flag = import.meta.env.VITE_DEMO_DATA
  if (flag === '1') return true
  if (flag === '0') return false
  try {
    const res = await fetch('/api/health', { headers: { accept: 'application/json' } })
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return true
    const body = await res.json()
    return !(body && body.ok === true)
  } catch {
    return true
  }
}

export function demoEnabled(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  decision ??= decide()
  return decision
}
