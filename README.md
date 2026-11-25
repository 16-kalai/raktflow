# RaktFlow

**Blood before the festival, not after.**

Every Diwali, Durga Puja and Ganeshotsav, regular donors travel home, college drives stop, and blood banks run dry while transfusions for thalassemia, cancer and surgery patients keep coming. RaktFlow forecasts that shortage weeks ahead and calls eligible donors **before** the festival window, so the gap is covered before it opens.

- **Live demo:** https://raktflow.vercel.app → click **"View live demo"** (one-click login, no signup)
- **Built for:** WeMakeDevs Festive Hacks, Bengaluru, 25 Nov 2026

## What it does

1. **Forecasts the shortage.** A FIFO stock model per blood group (expiry, 3 days of safe stock, festive donor drop-off, pinned patient transfusions) projects 28 days ahead. In the demo, O+ falls below safe stock on 11 Nov, with a gap of 25 units.
2. **Asks a human first.** The plan goes to a **NudgeBee** workflow. An LLM summarises it, a coordinator approves it in NudgeBee, and the workflow switches on Flagsmith's `surge_mode`.
3. **Calls donors.** Voice workers on Kubernetes pick up call jobs and place real phone calls through a **Sarvam AI** voice agent. The agent says it is an AI on a recorded line, checks health screening questions, offers live slots and books one through RaktFlow's API.
4. **Stops when the gap is covered.** Bookings × expected yield (0.7 show-up × 0.89 pass rate) are counted against the gap. When the gap is covered, RaktFlow turns `surge_mode` off and the workers stop dialling.

## How each sponsor is used

| Sponsor | What it does in RaktFlow |
|---|---|
| **Flagsmith** | The control room. `festive_mode` is enabled by segments (`festive_season_MH`, `festive_season_WB`) using the bank's state and today's date as traits. `surge_mode` is the kill switch that starts and stops all calling. `max_concurrent_calls` caps calls across every pod. `forecast_config`, `call_script` and `health_questions` are remote config, so ops can change the forecast and the call script without a deploy. Server-side local evaluation refreshes every 10s, and flags fail closed (no calls) if Flagsmith is unreachable. |
| **NudgeBee** | Human approval and ops automation. The "Blood shortage approval" workflow goes webhook → LLM summary → in-app approval → Flagsmith API (`surge_mode` ON) → callback to RaktFlow. The NudgeBee agent also watches the `raktflow` namespace on the Kubernetes cluster. |
| **Sarvam AI** | The voice agent ("RaktFlow Donor Booking", Samvaad) places outbound calls in English and Indian languages. It uses tools for `get_slots` and `book_slot` (authenticated with `x-api-key`), records health answers and opt-outs, and sends a post-call webhook with the transcript. |

## Architecture

```
Next.js web app (Vercel) ──┬── Neon Postgres (stock, donors, patients, campaigns, call_jobs, events)
  forecast, dashboard,     │
  patients, donor CSV      ├── Flagsmith (flags + segments + remote config)
                           │
  shortage ─► NudgeBee workflow ─► approval ─► Flagsmith surge_mode ON ─► /api/ops/nudgebee
                                                       │
Voice workers (Kubernetes, 3 replicas, KEDA-ready) ◄───┘ poll call_jobs
  lease + SKIP LOCKED claim, global Postgres call permits
        │
        └─► Sarvam voice agent ─► tools: /api/tools/get_slots, /api/tools/book_slot
                               └─► /api/webhooks/sarvam ─► transcript, outcome, opt-out
```

**Built to scale:**
- Call jobs are claimed with `FOR UPDATE SKIP LOCKED` and a lease. A pod that dies mid-call releases its job when the lease runs out.
- A global, advisory-locked permit table enforces `max_concurrent_calls` across all pods.
- Bookings and webhooks are idempotent, so replays are safe.
- Donor CSV import validates rows, normalises phones to E.164, de-duplicates and inserts in batches of 500 (up to 50k rows per file).
- The worker image is a single esbuild bundle, with a KEDA ScaledObject in `deploy/k8s`.

**Safety:**
- Donors are only called if they consented, passed the DND check, are past the 90/120-day donation gap, and have not opted out.
- Flagsmith and Sarvam see a pseudonymous donor ID, not names or phone numbers.
- Synthetic demo donors are never dialled. Only a NudgeBee approval rings the single demo phone. Approving inside the app books test donors only.

## Repo layout

```
apps/web        Next.js 16, shadcn/ui, Better Auth, Recharts (dashboard, patients, donors, APIs)
apps/worker     Node voice worker (Sarvam outbound calls)
packages/core   Forecast engine (pure, unit-tested with vitest)
packages/db     Drizzle schema, migrations, seed
packages/flags  Flagsmith client (local evaluation) + admin API
packages/sarvam Sarvam client
packages/domain Campaigns, call jobs, bookings, events
deploy/         Kubernetes manifests + build-worker.sh
docs/           SPONSOR-SETUP.md: step-by-step Flagsmith / Sarvam / NudgeBee setup
```

## Run it locally

Requirements: Node 22+, pnpm 12, a Postgres URL (Neon works), and optionally a local Kubernetes cluster (OrbStack) for the worker.

```bash
pnpm install
# create apps/web/.env.local with the variables below
pnpm db:migrate && pnpm db:seed
pnpm dev                                              # http://localhost:3000
pnpm test                                             # forecast engine tests
./deploy/build-worker.sh                              # build + deploy voice workers to k8s
```

Environment variables (keep them in the gitignored `.env.local`; never commit them):

- **Database / auth:** `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_URL`, `RAKTFLOW_API_KEY`
- **Flagsmith:** `FLAGSMITH_SERVER_KEY`, `FLAGSMITH_ENVIRONMENT_KEY`, `FLAGSMITH_ADMIN_API_KEY`, `FLAGSMITH_PROJECT_ID`
- **NudgeBee:** `NUDGEBEE_SHORTAGE_WEBHOOK_URL`
- **Sarvam:** `SARVAM_VOICE_API_KEY`, `SARVAM_ORG_ID`, `SARVAM_WORKSPACE_ID`, `SARVAM_APP_ID`, `SARVAM_APP_VERSION`, `SARVAM_CONNECTION_ID`
- **Demo:** `DEMO_LOGIN_EMAIL`, `DEMO_LOGIN_PASSWORD`, `DEMO_DONOR_PHONE`

Full sponsor setup, including flag names, segments, the agent prompt and workflow steps, is in [docs/SPONSOR-SETUP.md](docs/SPONSOR-SETUP.md).

## Data sources for the numbers on the landing page

- 35–40 surgeries a day at Tata Memorial, with nearly half at risk six days after Diwali: Hindustan Times, 15 Nov 2026.
- 10 of 15 blood banks in Nagpur with zero whole blood since Diwali began: The Hitavada, 14 Nov 2026.
- 3 days of blood left for the whole of West Bengal after the Pujas: Millennium Post, 19 Nov 2026.
- The demo bank's stock, donors and patients are synthetic. Patient names are illustrative.

## AI use disclosure

This project was built with help from Claude Code (Anthropic) for code, UI and documentation. Inside the product, AI is used in two places: the Sarvam voice agent that talks to donors, and the NudgeBee LLM step that summarises the shortage plan for the approver. A human approves every campaign before any donor is called.

## License

MIT
