# RaktFlow

**Blood before the festival, not after.**

Every Diwali, Durga Puja and Ganeshotsav, regular donors travel home, college drives stop, and blood banks run dry while transfusions for thalassemia, cancer and surgery patients keep coming. RaktFlow forecasts that shortage weeks ahead and calls eligible donors **before** the festival window, so the gap is covered before it opens.

- **Live demo:** https://raktflow.vercel.app → click **"View live demo"** (one-click login, no signup)
- **Built for:** WeMakeDevs Festive Hacks, Bengaluru, 25 Nov 2026

## The problem

### Every festival season, India's blood banks run dry, and patients wait

India's blood supply depends on two things: **donation camps** (colleges, offices, housing societies) and **regular donors who live near the bank**. During Diwali, Durga Puja and the other festival weeks, both disappear at the same time. Camps aren't held, and donors travel home. **But the demand doesn't stop.** Thalassemia children still need transfusions on schedule, and cancer surgeries, accidents and deliveries keep coming.

This year alone, in the three weeks around Diwali and the Pujas:

| When | Where | What happened | Source |
|---|---|---|---|
| Oct 30 2026 | Dhanbad | A thalassemia patient waited **11 days** for blood | Times of India |
| Nov 14 2026 | Nagpur | **10 of 15** blood banks had **zero whole blood**, low *"since the beginning of Diwali"*. Hospitals asked patients' families and staff to donate | The Hitavada |
| Nov 15 2026 | Mumbai | Tata Memorial, India's leading cancer hospital, does **35–40 surgeries a day** and warned **nearly half** could be affected. Maharashtra's blood council blamed reduced donations over the Diwali holidays | Hindustan Times · The Indian Practitioner |
| Nov 17 2026 | Mumbai | Sion hospital needs **90–120 units a day** and collected **14** at a recent camp. About **300 thalassemia children** depend on Nair, Sion and KEM | The Indian Practitioner |
| Nov 19 2026 | West Bengal | After the Pujas the whole state had about **10,150 units** against a need of **~3,000 a day**: roughly **3 days of blood** | Millennium Post |

**It's not new; it comes back every year:** Mumbai 2017 · Pune 2023 · Maharashtra and Surat 2024 · Pune 2025 · and **7 separate reports in 3 weeks** in 2026.

### Why it keeps happening

1. **The supply drops on a known date.** Camps pause and donors leave the city for the festival. Diwali is on the calendar a year ahead, but nobody plans the blood drive around it.
2. **You can't stockpile.** Red cells last **35–42 days** and platelets only **5**. A bank can't simply collect extra in September.
3. **Banks only see today.** Stock systems (including the government's e-RaktKosh portal) show what's on the shelf **now**. A coordinator knows today's O+ count, but not whether it'll last until the 14th, when a thalassemia child is booked for a transfusion.
4. **The fix is a phone and a list.** When stock runs low, a coordinator calls donors one by one. Sankalp India Foundation (Bengaluru) wrote that in a holiday shortage, a coordinator spent **6 hours calling 30+ donors, and 2 came** that day.

> **India doesn't run out of donors. It runs out of donors in the right city, in the right week.**

### What a blood bank actually needs

- **A warning weeks ahead**, per blood group, for this bank and this festival window, with the patients whose blood is at risk pinned on the chart.
- **A human decision**, because the medical officer has to approve before anyone calls donors.
- **Calls that happen at scale and in the donor's language, before the donor travels**, that screen for eligibility and book a real slot.
- **A stop signal**, so calling ends the moment the gap is covered, and nobody is over-collected or spammed.

That is what RaktFlow does.

## What it does

1. **Forecasts the shortage.** A FIFO stock model per blood group (expiry, 3 days of safe stock, festive donor drop-off, pinned patient transfusions) projects 28 days ahead. In the demo, O+ falls below safe stock on 11 Nov, with a gap of 25 units.
2. **Asks a human first.** The plan goes to a **NudgeBee** workflow. An LLM summarises it, a coordinator approves it in NudgeBee, and the workflow switches on Flagsmith's `surge_mode`.
3. **Calls donors.** Voice workers on Kubernetes pick up call jobs and place real phone calls through a **Sarvam AI** voice agent. The agent says it is an AI on a recorded line, checks health screening questions, offers live slots and books one through RaktFlow's API.
4. **Stops when the gap is covered.** Bookings × expected yield (0.7 show-up × 0.89 pass rate) are counted against the gap. When the gap is covered, RaktFlow turns `surge_mode` off and the workers stop dialling.

## How the sponsors work together

None of the three is bolted on. Remove any one and the product stops working: Flagsmith switches it on, NudgeBee lets it act, and Sarvam does the calling.

```
Flagsmith segment flips festive_mode on (state + date traits)
   → forecast shows O+ short on 11 Nov, gap 25 units
   → NudgeBee: AI summary → medical officer approves → NudgeBee writes surge_mode ON in Flagsmith
   → voice workers on Kubernetes (watched by the NudgeBee agent) see surge_mode and start dialling
   → Sarvam agent calls the donor, asks Flagsmith's health questions, books a slot through RaktFlow's API
   → gap covered → RaktFlow writes surge_mode OFF in Flagsmith → every worker stops within seconds
```

### 🟢 Flagsmith: the control room (7 flags · 2 segments · 2 identity types)

| Flag | Type | Who changes it | What it controls in the code |
|---|---|---|---|
| `festive_mode` | on/off + segment overrides | **Segments** `festive_season_MH`, `festive_season_WB` (traits `state` and `today`) | Applies festive donor drop-off in the forecast for that state's festival window ([forecast.ts](packages/domain/src/forecast.ts)) |
| `surge_mode` | on/off | **NudgeBee** turns it on after approval. **RaktFlow** turns it off when the gap is covered | Checked by every worker before every dial: off means nobody gets called ([main.ts](apps/worker/src/main.ts)) |
| `outbound_calls_enabled` | on/off | Ops | Global kill switch for all outbound calls |
| `max_concurrent_calls` | number | Ops | Enforced across **all pods** by an advisory-locked Postgres permit table ([calls.ts](packages/domain/src/calls.ts)) |
| `health_questions` | JSON, versioned, validated with zod | Medical officer | The exact screening questions the Sarvam agent asks on every call. The version is logged per call |
| `forecast_config` | JSON, validated with zod | Ops | Horizon, safe-stock days, shelf life, show-up and screening yield, festival factors |
| `call_script` | string per donor identity | Ops | Evaluated per donor (traits: language, donor type, state). Wiring it into the agent prompt is the next step |

How it's built:
- **Identities, not just flags.** Each bank is an identity (`bank_<slug>` with `state` + `today` traits), so festive mode turns on **by itself** per state and per date. Drag the dashboard's time-travel clock and you can watch it happen. Each donor is a pseudonymous identity (`donor_<ref>`).
- **Local evaluation.** The server-side key keeps the environment document in memory, so a flag check costs no network call, however many requests or workers there are ([client.ts](packages/flags/src/client.ts)).
- **Fails closed.** If Flagsmith is unreachable, the defaults are no festive mode, no surge and 0 concurrent calls. Nobody gets called by accident ([definitions.ts](packages/flags/src/definitions.ts)).
- **Write path.** NudgeBee and RaktFlow both write flags through the Flagsmith Admin API ([admin.ts](packages/flags/src/admin.ts)). A bootstrap script creates every flag and segment and is safe to run twice ([bootstrap.ts](packages/flags/src/bootstrap.ts)).
- **Change propagation.** An HMAC-verified audit webhook ([/api/webhooks/flagsmith](apps/web/src/app/api/webhooks/flagsmith/route.ts)) refreshes the cache at once and logs who changed what to the dashboard's activity feed. On top of that, flags refresh every 10 seconds and immediately after RaktFlow's own writes.

### 🔵 NudgeBee: the human in the loop and ops (live workflow)

**Workflow "Blood shortage approval"** (live on the `raktflow-orbstack` account):
1. **Webhook trigger.** RaktFlow posts the shortage plan: group, date, gap, bookings needed and why ([campaigns.ts](packages/domain/src/campaigns.ts)).
2. **`llm_summary`.** An LLM turns the plan into a short brief for the medical officer.
3. **`core_approval`.** An in-app approval with a 1-hour timeout.
4. **`integrations_http`.** Runs only if not rejected: a PATCH to Flagsmith that turns `surge_mode` on.
5. **`integrations_http-1`.** A callback to [/api/ops/nudgebee](apps/web/src/app/api/ops/nudgebee/route.ts) that records the approver and run id in RaktFlow's audit trail.

**The approval is the safety gate.** Only a campaign approved through NudgeBee can ring a real phone. The in-app "approve here" fallback books simulated test donors only.

**Kubernetes ops.** The NudgeBee agent runs on the cluster via Helm and watches the `raktflow` namespace where the voice workers run.

**Rate-limit loop (code shipped).** Each worker counts Sarvam 429s ([limits.ts](apps/worker/src/limits.ts)). Three or more in 60 seconds sends NudgeBee a webhook with a suggested lower `max_concurrent_calls`. Workflow B (logs → AI investigation → approval → Flagsmith) is described in [SPONSOR-SETUP.md](docs/SPONSOR-SETUP.md).

### 🟣 Sarvam AI: the voice (real calls)

- **The agent.** "RaktFlow Donor Booking" (Samvaad) places real outbound calls through the Sarvam Voice API ([packages/sarvam](packages/sarvam/src/index.ts)). Donor languages map to 11 Indian languages.
- **Disclosure.** The agent says it is an AI on a recorded line and that the donor can say "stop" at any time.
- **Inputs per call.** It gets exactly 7 variables: donor ref, name, centre, blood group, festive window and **the health questions from Flagsmith**.
- **Two tools that call back into RaktFlow.** [`get_slots`](apps/web/src/app/api/tools/get_slots/route.ts) reads live capacity and [`book_slot`](apps/web/src/app/api/tools/book_slot/route.ts) books idempotently. Both authenticate with `x-api-key`, stored as a Sarvam workspace secret.
- **After the call.** The [post-call webhook](apps/web/src/app/api/webhooks/sarvam/route.ts) stores the transcript, the health answers and the outcome (booked / declined / deferred / opted-out). Opting out removes the donor from future calls. If the agent reports a deferral (e.g. recent fever), the donor is held back for that many days.
- **Back-pressure.** A 429 from Sarvam releases the call permit and re-queues the job with jitter. Nothing is dropped and nobody is called twice.
- **Proof.** A real call made today booked donor Ravi for **2 Nov, 5 PM**, with all three health checks answered, and the transcript appeared live on the dashboard.

## Architecture

```
Next.js web app (Vercel) ──┬── Neon Postgres (stock, donors, patients, campaigns, call_jobs, events)
  forecast, dashboard,     │
  patients, donor CSV      ├── Flagsmith (flags + segments + remote config)
                           │
  shortage ─► NudgeBee workflow ─► approval ─► Flagsmith surge_mode ON ─► /api/ops/nudgebee
                                                       │
Voice workers (Kubernetes, 3 replicas; KEDA ScaledObject 1→50 on queue depth) ◄───┘ poll call_jobs
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
- The worker image is a single esbuild bundle. A KEDA ScaledObject in `deploy/k8s` scales workers from 1 to 50 on the number of queued calls.

**Safety:**
- Donors are only called if they consented, passed the DND check, are past the 90/120-day donation gap, and have not opted out.
- Flagsmith only ever sees pseudonymous IDs (`bank_<slug>`, `donor_<ref>`). Sarvam receives only the name and number it needs to place the call.
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
cp .env.example apps/web/.env.local                   # fill in the values below
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

## Sources

Opened and checked on 25 Nov 2026:
- The Hitavada, 14 Nov 2026: Nagpur, 10 of 15 banks with no whole blood. https://www.thehitavada.com/Encyc/2026/11/14/10-blood-banks-run-out-of-whole-blood-stock-hospitals-ask-patients-relatives-and-staff-members-to-donate-blood.html
- The Indian Practitioner, 17 Nov 2026 (credits Hindustan Times): Tata Memorial 35–40 surgeries a day, nearly half at risk; Sion 90–120 units a day; ~300 thalassemia children; shortage due to reduced donations over Diwali. https://theindianpractitioner.com/blood-supply-crunch-threatens-surgeries-at-tata-memorial-other-mumbai-hospitals/
- Millennium Post, 19 Nov 2026: West Bengal needs ~3,000 units a day and had 10,150 units after the Pujas. https://www.millenniumpost.in/bengal/severe-shortage-bengal-to-hold-blood-donation-drive-683879
- Sankalp India Foundation, "Blood Shortage in December": 6 hours of calling, 30+ donors called, 2 came. https://sankalpindia.net/blood-donation-organization/blood-shortage-december

From our research dossier:
- Hindustan Times, 15 Nov 2026 (the original Tata Memorial report). https://www.hindustantimes.com/cities/mumbai-news/blood-shortage-hits-city-hospitals-in-festive-season-surgeries-deferred-101794683022517.html
- Times of India, 30 Oct 2026: Dhanbad thalassemia patient's 11-day wait. https://timesofindia.indiatimes.com/city/ranchi/dhanbad-thalassaemia-patient-gets-blood-after-11-day-wait/articleshow/135367796.cms
- Earlier years: Indian Express, 14 Nov 2017 (Mumbai) · TOI, 19 Nov 2023 (Pune) · TOI, 19 Nov 2024 (Maharashtra) · TOI, 14 Nov 2024 (Surat) · TOI, 30 Nov 2025 (Pune).
- The 7 reports in 2026: Dhanbad (TOI, 30 Oct) · Nagpur (Hitavada, 14 Nov) · Tata Memorial (HT, 15 Nov) · KEM (TOI, 16 Nov) · Tata/Sion (Indian Practitioner, 17 Nov) · Mumbai surgeries postponed (Gujarati Mid-Day, 19 Nov) · West Bengal (Millennium Post, 19 Nov).

The demo bank (Sahyog Blood Centre, Pune), its stock, donors and patients are synthetic. Patient names are illustrative.

## AI use disclosure

This project was built with help from Claude Code (Anthropic) for code, UI and documentation. Inside the product, AI is used in two places: the Sarvam voice agent that talks to donors, and the NudgeBee LLM step that summarises the shortage plan for the approver. A human approves every campaign before any donor is called.

## License

MIT, see [LICENSE](LICENSE).
