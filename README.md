# HAUL16 Web (frontend)

The operator console for **HAUL16**, a brand-abuse takedown desk. It watches Certificate
Transparency logs for look-alike domains of one brand, captures evidence, scores each site, opens
cases, drafts takedown notices, and makes a **named human approve every notice** before it is
"filed". Everything is a **dry run**: nothing is ever sent to a registrar, host, platform, telco or
regulator. The demo brand ("Nkwa Exchange") is fictional.

This repo is the **frontend only**. The Python/FastAPI backend lives in a separate repo:
**[dezmymachine/haul16-backend](https://github.com/dezmymachine/haul16-backend)**. The two talk over
a small JSON + SSE HTTP API, documented below. If you are an agent picking this up, read this whole
file first; the "Gotchas" and "How to extend" sections will save you the most time.

**Going live?** See section [11](#11-going-live-running-the-real-version-not-demo-data) here and, for the services, APIs and keys the real
version needs, section 9 of the backend README.

---

## 1. Quick start

Prerequisites: Node 24+ (Node 22 works), npm, and the backend running on `127.0.0.1:8000`.

```bash
# 1. backend (separate repo) - see its README
cd ../haul16-backend && uv sync && uv run uvicorn engine.api:app --port 8000

# 2. frontend (this repo)
npm install
npm run dev            # http://127.0.0.1:5173  (proxies /api and /demo-sites to :8000)
```

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on `127.0.0.1:5173` |
| `npm run typecheck` | `tsc --noEmit`. **Run this after every change** |
| `npm run build` | `vite build` then typecheck. Output in `dist/` |
| `npm run preview` | Serve the production build on :5173 |

Environment: `HAUL16_API` (default `http://127.0.0.1:8000`) changes the proxy target in
`vite.config.ts`. There are no other env vars and no secrets.

The backend must be reachable or every page shows an error alert. To try the whole flow without
waiting for real certificates, open **Watch** and click **Clone A**, then **Clone B, same operator**
(see "Demo walk-through").

---

## 2. Stack

- **TanStack Start in SPA mode** (`tanstackStart({ spa: { enabled: true } })` in `vite.config.ts`).
  No SSR: the Python API is the only server. Start is used for file-based routing and the build.
- **TanStack Router** (file-based routes in `src/routes`, generated `src/routeTree.gen.ts`).
- **TanStack Query** for all server state. One shared `QueryClient` created in `src/router.tsx`.
- **React 19**, **TypeScript** (strict, `noUnusedLocals`, `noUnusedParameters`).
- **Vite 8** (TanStack Start requires Vite >= 8; do not downgrade).
- **Tailwind CSS v4** (`@tailwindcss/vite`, CSS-first config in `src/styles.css`, no `tailwind.config`).
- **shadcn/ui** (style `new-york`, Radix via the `radix-ui` package, `lucide-react` icons),
  components in `src/components/ui/`.
- **Recharts** via the shadcn `chart` component (Watch page: certificate-rate area chart, threat-mix donut).
- **Sonner** for toasts. **Light mode only** (see "Design system").
- Font: **Figtree** (Google Fonts, loaded in `routes/__root.tsx`); IBM Plex Mono for hashes/hostnames
  (loaded in the same place, applied through the `font-mono` utility).

---

## 3. The product flow (read this before touching UI)

The UI is organised around one pipeline. Every page names its step and links to the next:

```
Detect (Watch) -> Triage (Threats) -> Case (Cases) -> Approve (Approvals) -> File (dry run) -> Track clock -> Report
```

1. **Watch** `/`: live certificate stream, threat mix, live pipeline feed, demo controls, manual URL submission.
2. **Threats** `/threats`: every hostname that matched the brand, with verdict (high / medium / low / unknown).
   Nothing is ever "safe": `unknown` means the page could not be seen yet.
3. **Cases** `/cases`: a case opens automatically when a capture scores **medium or high**. Sites that share
   a payment number, wallet or Telegram handle join the **same case** (campaign linking). Notices are drafted
   automatically per channel (registrar, hosting, Google Safe Browsing, telco, CSA).
4. **Approvals** `/approvals`: one inbox for every notice across cases, in tabs: Awaiting approval, Ready to
   file, Filed (dry run), Rejected. A named person approves or rejects (with a reason).
5. **File (dry run)** starts the **takedown clock** on the case. Clock events (first response, removed) are
   logged manually and are labelled simulated.
6. **Report** `/report`: monthly report, time-to-removal by channel, export JSON, print.
7. **Brand** `/brand`: read-only official asset register (names, domains, numbers, wallets, favicon hashes,
   authorisation letter hash). Edit `brand.yaml` in the **backend** repo to change it.

Human approval is enforced **server-side** (the backend returns 409 if you try to file an unapproved
notice). The UI mirrors it but is not the safeguard.

### Who is "acting"?
The approver name is global: top-right **account menu** (avatar + business name) -> "Acting as
(approver)". It is stored in `localStorage` (`haul16.approver`) via `useApprover()` in `src/ui.tsx` and
sent as `approver` on approve/reject. Approve/Reject are disabled until the name has 2+ characters. The
avatar button shows the business initials (e.g. "NE"), not the approver.

---

## 4. Directory map

```
src/
  api.ts                 typed fetch client + all API types (the contract with the backend)
  live.ts                the single SSE EventSource + cache-backed hooks (useFeed/useCt/useRate/useConnected)
  ui.tsx                 shared domain helpers: label maps, ConfidenceChip, StatusChip, Reason, Stat, Empty,
                         ErrorNote, fmtTime/fmtDuration, useNow, useApprover
  router.tsx             getRouter(): QueryClient + router + QueryClientProvider (Wrap)
  routeTree.gen.ts       GENERATED by the router plugin. Committed. Never edit by hand
  styles.css             Tailwind v4 entry, design tokens (CSS variables), @theme mapping, print + touch rules
  lib/utils.ts           cn() = clsx + tailwind-merge
  hooks/use-mobile.ts    shadcn mobile breakpoint hook
  routes/                file-based routes (page components live IN the route files)
    __root.tsx           <html> shell, fonts, SidebarProvider layout, Toaster, live SSE connection
    index.tsx            Watch  (/)
    threats.index.tsx    Threats list (/threats?confidence=)
    threats.$threatId.tsx  Threat detail
    cases.index.tsx      Cases list
    cases.$caseId.tsx    Case detail, tabbed (?tab=overview|evidence|notices|clock|audit)
    approvals.tsx        Approvals inbox (?status=drafted|approved|filed_dry_run|rejected)
    report.tsx           Monthly report
    brand.tsx            Brand register
  components/
    app-sidebar.tsx      left nav (Monitor / Respond / Insights), collapses to an icon rail
    page.tsx             <Page crumbs>: sticky top bar + NextStep banner + padded content
    page-header.tsx      <Crumbs> breadcrumb + <PageHeader> title/description/actions
    flow-menu.tsx        top-bar "Takedown flow" popover (4 steps with live counts)
    user-menu.tsx        top-right business avatar + popover with the approver name field
    workflow-stepper.tsx Detected -> Scored -> Case -> Approved -> Filed -> Removed
    notice-card.tsx      one takedown notice (recipient, subject, text, evidence hashes, actions)
    notice-actions.tsx   approve / reject (dialog) / file / log clock events; all mutations + toasts
    threat-evidence.tsx  screenshot + verdict reasons + facts (<ThreatEvidence>, <KV>)
    ui/                  shadcn components (see "shadcn rules")
public/favicon.svg
components.json          shadcn config (aliases @/components, @/lib/utils, ...)
vite.config.ts           plugins + dev proxy
```

Path alias: `@/*` -> `src/*` (tsconfig `paths` + `resolve.tsconfigPaths`).

---

## 5. Backend API contract

All calls are relative (`/api/...`) and go through the Vite proxy in dev. Types are in `src/api.ts`;
keep them in sync with the backend. `req()` throws `ApiError` and extracts FastAPI's `detail`
(string or validation list) into `.message`, which the UI shows in toasts/alerts.

| Method | Path | Used by | Notes |
|---|---|---|---|
| GET | `/api/stats` | sidebar badge, Watch, banners, flow menu | `counts{threats, by_confidence, open_cases, notices_drafted, notices_awaiting_approval, notices_filed}`, `ct{...}`, `queue` |
| GET | `/api/brand` | account menu, Brand, Watch | brand register + `authorisation_letter{ref, sha256}` |
| GET | `/api/threats?confidence=` | Threats, Watch feed | light rows (no capture/enrichment) |
| GET | `/api/threats/{id}` | Threat detail | full `capture`, `verdict`, `enrichment` |
| GET | `/api/cases` | Cases | summaries with counts |
| GET | `/api/cases/{id}` | Case detail | threats, identifiers, notices, clock, audit |
| POST | `/api/cases/{id}/redraft` | Case notices tab | `{drafted: n}` |
| GET | `/api/notices?status=` | Approvals | cross-case notices with `case_title`, `host` |
| POST | `/api/notices/{id}/approve` | NoticeActions | body `{approver}`; 409 unless `drafted` |
| POST | `/api/notices/{id}/reject` | NoticeActions | body `{approver, reason}`; 409 unless `drafted`/`approved` |
| POST | `/api/notices/{id}/file` | NoticeActions | dry run; 409 unless `approved`; starts clock |
| POST | `/api/notices/{id}/clock` | NoticeActions | body `{event: first_response\|removed, note}`; 409 unless filed |
| POST | `/api/inject` | Watch "Report a suspicious link" | body `{url, as_host?}` -> `{threat_id, duplicate}` |
| POST | `/api/demo/clone` | Watch demo | body `{variant: clone\|clone2\|decoy}` |
| POST | `/api/demo/reset` | Watch demo | wipes threats, cases, notices, audit |
| GET | `/api/report?month=YYYY-MM` | Report | |
| GET | `/api/evidence/{name}` | screenshots | `.png` / `.html` evidence files |
| GET | `/api/events` | `live.ts` | **SSE** (see below) |
| `/demo-sites/*` | static | | fixture clone pages served by the backend |

Notice status machine: `drafted -> approved -> filed_dry_run`, or `drafted/approved -> rejected`.
Confidence values: `high | medium | low | unknown`. Case status: `open | closed`.

### Live updates (SSE) - `src/live.ts`
`useLiveConnection(queryClient)` is called **once**, in `routes/__root.tsx`'s `Layout`. It opens one
`EventSource('/api/events')`, reconnects after 3s on error, and writes into the Query cache under
`['live', ...]` keys (these use a never-resolving `queryFn` and `staleTime: Infinity`; they are cache
slots, not fetches):

- `['live','feed']`: last 80 non-stat events (`hit`, `capturing`, `scored`, `filed`)
- `['live','ct']`: latest `ct_stats`; `['live','rate']`: sliding window of 60 `rate_now` values
- `['live','connected']`: boolean

Each event also invalidates related queries (`['stats']`, `['threats']`, `['cases']`, `['case', id]`,
`['notices']`). If you add a query that an event should refresh, add its key there. Read the live data
with `useFeed()`, `useCt()`, `useRate()`, `useConnected()`.

### Query keys in use
`['stats']`, `['brand']`, `['threats', filter]`, `['threats','recent']`, `['threat', id]`, `['cases']`,
`['case', id]`, `['notices']`, `['report', month]`. Mutations must invalidate the ones they affect
(see `notice-actions.tsx` `done()` for the pattern: case, cases, stats, notices).

---

## 6. Design system

**Light mode only. There is no dark mode, no `.dark` class and no `prefers-color-scheme` rule. Do not add one.**
`<html style="color-scheme: light">` is set in the root route.

Reference look: a Cake-Equity-style dashboard: indigo/lilac, big bold navy page titles, roomy sidebar,
lilac banner, a metrics column plus donut with a ranked legend.

Tokens live in `src/styles.css` as CSS variables, mapped to Tailwind via `@theme inline`:

| Token | Value | Use |
|---|---|---|
| `--primary` | `#5b3df5` (indigo) | primary buttons, links, active states |
| `--foreground` | `#1e1b4b` (navy) | text, titles |
| `--background` | `#f8f8fc` | page |
| `--accent` / `--secondary` | `#eeebfc` (lilac) | active nav, banner, hover |
| `--muted-foreground` | `#625f84` | secondary text |
| `--border` | `#e6e4f2` | hairlines |
| `--signal` | `#c2410c` (orange) | "needs you": awaiting approval, warnings, dry-run flag |
| `--high/medium/low/unknown/ok` (+ `-foreground`) | tinted pairs | confidence and status badges |
| `--radius` | `0.375rem` | **subtle** rounding everywhere |

Rules the product owner has set (keep them):

- **Subtle corners, never pills.** Everything uses `--radius` (6px). Badges are `rounded-md`, not `rounded-full`.
  Only the avatar and the tiny live-status dot are circles.
- **No left-edge accent bars** on cards or on the active nav item. Active nav = lilac fill only.
- **No sparkle/AI icons.** The takedown flow uses lucide `Scale`.
- Page titles are large and bold (`PageHeader`), fluid via `clamp()`.
- Badge variants beyond shadcn defaults (added in `ui/badge.tsx`): `high`, `medium`, `low`, `unknown`, `ok`, `warn`.
  Use `ConfidenceChip` / `StatusChip` from `ui.tsx` instead of picking variants by hand.
- Collapsed sidebar is a 4.75rem icon rail with 44px centered tiles (`SIDEBAR_WIDTH_ICON` in `ui/sidebar.tsx`,
  plus the `group-data-[collapsible=icon]:` classes in `app-sidebar.tsx`). Keep icons centered with breathing room.

### Layout
`routes/__root.tsx` renders `SidebarProvider > AppSidebar + SidebarInset`. Each page wraps itself in
`<Page crumbs={[...]}>` (`components/page.tsx`), which provides:
- sticky top bar: sidebar trigger, breadcrumbs, "Dry run" badge, **Takedown flow** menu, **business account** avatar;
- a dismissible **NextStep** banner (e.g. "4 takedown notices are waiting for your approval") hidden on `/approvals`;
- content container `max-w-[88rem]` with `grid-cols-[minmax(0,1fr)]` (the `minmax(0,...)` matters: without it wide
  children blow the page wider than the viewport).

### Responsive rules (all verified at 390px and 768px wide: no horizontal page scroll)
- Mobile-first; breakpoints are Tailwind defaults. Touch targets are >= 44px under 768px (`@media (max-width: 767px)` in `styles.css`).
- On mobile the sidebar is a sheet and **closes on navigation** (`useSidebar().setOpenMobile(false)` on pathname change in `app-sidebar.tsx`).
- Tab bars (`Approvals`, `Case`) sit in `overflow-x-auto` wrappers; long strings use `[overflow-wrap:anywhere]`/`break-all`.
- Tables use the shadcn `Table`, which already scrolls horizontally inside its container.
- Top bar: "Dry run" text shortens below `lg`; the breadcrumb truncates; the business name hides below `sm`.

### Print
`@media print` in `styles.css` hides the sidebar and `.no-print` elements (Report page uses it). New chrome that
should not print needs the `no-print` class.

---

## 7. shadcn rules and gotchas

- Add components with `npx shadcn@latest add <name> -y -o`. Config is in `components.json`.
- **GOTCHA: the CLI sometimes emits `import { cn } from "cn"`** (and may add a bogus `cn` npm package). The
  project's helper is `@/lib/utils`. After adding a component run
  `sed -i 's#from "cn"#from "@/lib/utils"#' src/components/ui/*.tsx` and `npm rm cn` if it appeared.
- `ui/sonner.tsx` was edited to be **light-only** (no `next-themes`). Re-apply if you regenerate it.
- `ui/badge.tsx` has the extra status variants. `ui/sidebar.tsx` has `SIDEBAR_WIDTH_ICON = "4.75rem"`.
  Re-apply these if you regenerate those files.
- Do not hand-edit other files in `components/ui/`; compose them in `components/`.

---

## 8. Conventions

- **Server state = TanStack Query.** Never keep fetched data in `useState`. Mutations call `toast.success/error`
  (Sonner) and invalidate the relevant keys.
- **Search params for view state**: Threats `confidence`, Case `tab`, Approvals `status`. Declared with
  `validateSearch` returning **optional** fields (so links like `<Link to="/cases/$caseId">` need no `search`),
  and defaults applied at the read site (`const { tab = 'overview' } = Route.useSearch()`).
- **Browser-only APIs** (`EventSource`, `localStorage`, `window.print`) are only touched in effects/handlers.
  `useApprover` reads `localStorage` in an effect (no SSR hydration mismatch even though SPA mode is on).
- Domain label maps (`REASON_LABEL`, `CHANNEL_LABEL`) live in `ui.tsx`. New backend reason codes or channels
  need an entry there or the raw code is shown.
- Copy: sentence case, plain verbs, name an action the same everywhere ("Approve", "File (dry run)").
  Errors say what went wrong. Empty states point to the next action.
- Imports use `@/`. Keep `tsc --noEmit` clean (unused locals/params are errors).

---

## 9. How to extend (recipes)

**Add a page**: create `src/routes/<name>.tsx` with `createFileRoute('/<name>')`, wrap content in `<Page crumbs>`
and start with `<PageHeader>`. The route tree regenerates when the dev server or build runs. Add a nav entry in
`NAV` in `components/app-sidebar.tsx`. If it is a pipeline step, add it to `components/flow-menu.tsx`.

**Add an API call**: add the type and a method to `api` in `src/api.ts`, then `useQuery({ queryKey, queryFn })`
in the page. If an SSE event should refresh it, add the invalidation in `live.ts`.

**Add a notice action or status**: extend `NoticeStatus` in `api.ts`, `STATUS_VARIANT` in `ui.tsx`,
the tabs in `routes/approvals.tsx` and the buttons in `components/notice-actions.tsx`.

**Add a confidence/reason/channel label**: edit the maps in `ui.tsx`.

**Change the theme**: edit variables in `:root` in `styles.css` only. Do not introduce hex colors in components
except in charts (`MIX` in `routes/index.tsx`, which needs literal colors for SVG).

---

## 10. Testing and verification

There is no unit-test runner yet. Verification used so far:

1. `npm run typecheck` and `npm run build` must pass.
2. Browser walk-through with Playwright (Python or Node) against the dev server: Watch -> Clone A / Clone B ->
   Threats -> Cases -> Approvals (approve, file) -> case Clock tab -> Report -> Brand. Check no console errors.
3. Responsive check at 390px and 768px: `document.documentElement.scrollWidth - innerWidth` must be 0 on every route.
4. Mobile sidebar: open, tap a nav item, assert the sheet closes.

A good next step is adding Vitest + Testing Library for `ui.tsx` helpers, and Playwright specs for the flow above.

### Demo walk-through
1. Open **Watch**. Real CT matches appear in the live feed if the backend runs with CT polling on.
2. Click **Clone A** (fictional `nkwaex-support.com`). It is captured, scored high and a case opens with drafted notices.
3. Click **Clone B, same operator**. It shares a MoMo number, so it **joins the same case** (campaign linking).
4. Click **Decoy business** (`nkwafarms.com`): scores **low**, opens no case.
5. Set your name in the top-right account menu, go to **Approvals**, approve a notice, then **File (dry run)**.
6. Open the case -> **Clock** tab, log "first response" and "removed". Then open **Report**.
Use **Reset demo data** on Watch to start over.

---

## 11. Going live: running the real version (not demo data)

The full checklist (data sources, APIs, services, accounts, keys, infrastructure, legal prerequisites) is in the backend repo:
**[haul16-backend README, section 9](https://github.com/dezmymachine/haul16-backend#9-going-live-running-the-real-version-not-demo-data)**.
This section lists only what changes **in the frontend** when the backend goes live.

**What the frontend needs from the backend before it can go live** (each is `NEEDS BUILD` on the backend):
login/session, roles, real notice senders, inbound-response tracking, a liveness checker for removals, a `dry_run` flag in
`/api/health`, brand onboarding endpoints. The UI today assumes a single brand, no login and a dry-run backend.

| Area | Demo today | For live | Where |
|---|---|---|---|
| API base | Relative `/api/...` through the Vite dev proxy (`vite.config.ts`, `HAUL16_API`) | Serve the built frontend and the API from **one origin** behind a reverse proxy (route `/api` to the backend), so no CORS and no base-URL config is needed. If you must split origins, add `VITE_API_BASE`, prefix it in `req()` in `src/api.ts` and in `live.ts`, and set the backend CORS allow-list | `src/api.ts`, `src/live.ts` |
| SSE | `new EventSource('/api/events')` | The proxy must **disable response buffering** and allow long-lived connections (for example nginx `proxy_buffering off; proxy_read_timeout 1h`). Cookie auth works with `EventSource`; bearer headers do not (use cookies or a short-lived token query param) | `src/live.ts` |
| Auth | None. "Acting as" is free text in `localStorage` | Login (OIDC/SSO), redirect unauthenticated users, attach credentials (`credentials: 'include'`) in `req()`, handle 401/403 globally, and **remove the free-text approver**: show the signed-in user in the account menu and let the backend take the approver from the session | `src/api.ts`, `src/ui.tsx` (`useApprover`), `components/user-menu.tsx`, `components/notice-actions.tsx` |
| Roles | Everyone can do everything | Hide or disable Approve/Reject/File for non-approvers, hide Brand editing for non-admins (the backend must enforce too) | `components/notice-actions.tsx`, `routes/brand.tsx` |
| Demo controls | Watch page has "Run a demo clone" and "Reset demo data" | **Remove or gate behind a build flag / `HAUL16_ENV`.** Reset deletes all data | `routes/index.tsx` (`DemoPanel`) |
| Dry-run indicator | Static "Dry run" badge in the top bar | Drive it from `GET /api/health` `dry_run`: show **DRY RUN** or a clearly different **LIVE** state, and make "File (dry run)" buttons read "File" when live. Notice status `filed_dry_run` needs a live counterpart (for example `filed`) in `api.ts`, `ui.tsx`, `workflow-stepper.tsx`, Approvals tabs and Report | `components/page.tsx`, `components/notice-actions.tsx`, `src/api.ts` |
| Assisted filing | n/a | If you ship "assisted mode" (a human files by hand), add a notice view with Copy text, Evidence pack download and a link to the official form, plus a "Mark filed" action | `components/notice-card.tsx`, `components/notice-actions.tsx` |
| Real clock | Operator buttons "Log first response / Mark removed" (simulated) | When the backend records real events, show their source and hide the manual buttons for automated channels; label simulated rows | `routes/cases.$caseId.tsx` (`Clock`), `components/notice-actions.tsx` |
| Brand onboarding | Read-only Brand page | Forms for names, domains, numbers, wallets, favicon hashes, allow-list and the authorisation letter upload | `routes/brand.tsx` |
| Scale | Lists load everything | Server-side pagination, search and filters for Threats, Cases, Notices (the API will need `limit`/`cursor`) | `routes/threats.index.tsx`, `routes/cases.index.tsx`, `routes/approvals.tsx` |
| Errors and monitoring | Toasts and inline alerts | Add an error boundary, a front-end error tracker (for example Sentry, *(proposed)* `VITE_SENTRY_DSN`) and an offline/API-down banner | `routes/__root.tsx` |
| Build and hosting | `npm run dev` | `npm run build` (output in `dist/`; confirm the client folder after a build) and serve it as static files from a CDN or the reverse proxy, with an SPA fallback to the shell HTML for deep links such as `/cases/<id>`. No Node server is required in SPA mode | `vite.config.ts` |
| Security headers | none | Set CSP (note the Google Fonts links in `routes/__root.tsx`; self-host the fonts to tighten CSP), `X-Content-Type-Options`, `frame-ancestors`, HSTS at the proxy | proxy config |
| Evidence images | `/api/evidence/<name>` | Serve through an authenticated route or short-lived signed URLs; attacker-controlled screenshots must never be served from the app's origin as HTML | `src/api.ts` (`evidenceUrl`) |

**Configuration the frontend would read in a live build** *(all proposed; today only the dev-proxy `HAUL16_API` exists, and it is a
build-tool variable, not shipped to the browser)*: `VITE_API_BASE` (only if API is on another origin), `VITE_SENTRY_DSN`,
`VITE_OIDC_*` (only if the login flow runs in the browser). Never put secrets in `VITE_*` variables: they are public in the bundle.
No API keys belong in the frontend at all; every third-party key (email, Web Risk, WHOIS, blockchain explorers, storage) stays on the backend.

## 12. Known gaps / ideas

- No automated tests (see above). No auth: "Acting as" is a free-text name, not a login.
- Rate chart is empty until the first few `ct_stats` events arrive (about 2s each).
- The Approvals list loads all notices and filters client-side (fine for demo scale; add server paging later).
- Threats/Cases tables have no pagination or search yet.
- `routeTree.gen.ts` is committed on purpose so `tsc` works on a fresh clone before the first build.

## 13. Related

- Backend: https://github.com/dezmymachine/haul16-backend (pipeline, scoring, notices, API, SQLite store)
- This is a **dry-run demo**. Do not wire real sending of notices without legal review, verified recipient
  addresses and an explicit human-in-the-loop design.
