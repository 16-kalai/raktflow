# Sponsor setup (dashboard steps)

`APP_URL` below is the deployed RaktFlow URL (Vercel). `RAKTFLOW_API_KEY` is in `.env.local`.

---

## 1. Flagsmith

1. Create a project **RaktFlow**. Use the **Production** environment.
2. Put four values in `.env.local`:
   - `FLAGSMITH_SERVER_KEY`: Environment Settings → SDK Keys → create a **server-side** key (starts with `ser.`).
   - `FLAGSMITH_ENVIRONMENT_KEY`: the environment's key shown in Environment Settings.
   - `FLAGSMITH_PROJECT_ID`: the number in the project URL.
   - `FLAGSMITH_ADMIN_API_KEY`: Organisation Settings → API Keys.
3. Create the flags and segments: `pnpm --filter @raktflow/flags bootstrap`. It prints the feature IDs that NudgeBee needs.
4. Audit-log webhook: Organisation Settings → Webhooks → add `APP_URL/api/webhooks/flagsmith` with a secret, and put that secret in `FLAGSMITH_WEBHOOK_SECRET`.

What the bootstrap creates:

| Flag | Type | Who changes it |
|---|---|---|
| `festive_mode` | on/off, turned ON by the segments `festive_season_MH` and `festive_season_WB` (state + date) | Nobody; the date does |
| `surge_mode` | on/off | NudgeBee, after the medical officer approves |
| `outbound_calls_enabled` | kill switch | Operations |
| `max_concurrent_calls` | number (4) | NudgeBee, when the voice provider rate-limits |
| `forecast_config` | JSON | Bank (forecast assumptions) |
| `call_script` | `festive` / `standard` per donor identity | Bank |
| `health_questions` | JSON (v2, 3 questions) | Medical officer only (change request on Scale-Up) |

---

## 2. Sarvam voice agent (Samvaad)

**Phone:** Deploy → Phone Numbers → Rent from Sarvam (KYC), then copy the **connection ID** and the **number**.

**Agent:** create an agent called **RaktFlow Donor Caller**.
- Default language: English. Voice: a female voice.
- Copy the agent ID into `SARVAM_APP_ID` and the published version into `SARVAM_APP_VERSION`.

**Agent variables** (RaktFlow sends these on every call): `donor_ref`, `donor_name`, `bank_name`, `blood_group`, `drive_start`, `drive_end`, `call_script`, `health_questions`, `health_questions_version`.

**Instructions** (paste into the agent prompt):

```
You are the AI assistant of {{bank_name}}, a blood centre, calling a registered blood donor.
Speak simply and warmly. Keep the call under 2 minutes. Never give medical advice.

1. Ask: "Hello, is this {{donor_name}}?" If it's not them, apologise and end the call.
2. Say you are an AI assistant from {{bank_name}}, the call is recorded, and they can say "stop" at any time
   to stop these calls. If they say stop: set opted_out = true, thank them, end the call.
3. Explain: "We expect a shortage of {{blood_group}} blood after Diwali. If you're travelling for the festival,
   could you donate before you leave?" The drive runs {{drive_start}} to {{drive_end}}.
4. If they agree, ask which day suits them, then call tool:get_slots with that date (YYYY-MM-DD).
   Offer the first one or two times from the result.
5. Before booking, ask these health questions one at a time: {{health_questions}}
   Save the answers in health_answers, e.g. {"fever":"no","tattoo_surgery":"no","antibiotics":"no"}.
   If any answer is yes: do not book. Thank them, say they can donate after the waiting period, and that the
   centre will call then. Set deferred_days (fever 14, tattoo/piercing/surgery 365, antibiotics 7). End politely.
6. If all answers are no, call tool:book_slot with the date and time.
7. Confirm: "You're booked. The doctor will check your hemoglobin and blood pressure at the centre,
   so please eat before you come and bring an ID. Thank you, and happy Diwali!"
If they can't donate before the drive ends, thank them and end the call. Never pressure anyone.
```

**Tools** (API tools; auth type `api_key`, header `x-api-key: <RAKTFLOW_API_KEY>`):

| Tool | Method + URL | Body |
|---|---|---|
| `get_slots` | `POST APP_URL/api/tools/get_slots` | `{"donor_ref": "{{donor_ref}}", "date": "<date the donor chose, YYYY-MM-DD>"}` |
| `book_slot` | `POST APP_URL/api/tools/book_slot` | `{"donor_ref": "{{donor_ref}}", "date": "<YYYY-MM-DD>", "time": "<HH:MM>", "interaction_id": "@Interaction ID"}` |

Both tools return a `message` field. Have the agent read it.

**Keys** for `.env.local`:
- `SARVAM_VOICE_API_KEY`: Voice Agents → Settings → API Key.
- `SARVAM_ORG_ID` and `SARVAM_WORKSPACE_ID`: from the dashboard URL.
- `SARVAM_CONNECTION_ID` and `SARVAM_AGENT_PHONE`: from the phone connection.
- `DEMO_DONOR_PHONE`: the teammate's number, in E.164 format.

---

## 3. NudgeBee

1. Sign up at app.nudgebee.com and connect Slack (Integrations).
2. Install the agent on the OrbStack cluster: Settings → Agent → copy the `helm install` command and run it.
3. Create an API token (avatar → API Tokens) and put it in `NUDGEBEE_API_TOKEN`.

### Workflow A: "Blood shortage approval"
Trigger: **Webhook** (create a Webhook integration). Put its URL in `NUDGEBEE_SHORTAGE_WEBHOOK_URL`.
1. **AI Summary**: "Summarise this blood shortage forecast for a medical officer in 4 lines: `{{ Inputs.webhook_json }}`"
2. **Approval**: Slack channel `#raktflow-approvals`.
3. **HTTP request**: turn `surge_mode` on.
   - `PATCH https://api.flagsmith.com/api/__future__/environments/<FLAGSMITH_ENVIRONMENT_KEY>/features/<surge_mode id>/`
   - Header `Authorization: Api-Key <FLAGSMITH_ADMIN_API_KEY>`
   - Body `{"environment_default": {"enabled": true}}`
4. **HTTP request**: tell RaktFlow who approved.
   - `POST APP_URL/api/ops/nudgebee`
   - Header `x-api-key: <RAKTFLOW_API_KEY>`
   - Body `{"campaign_id": "{{ Inputs.webhook_json.campaign_id }}", "approved_by": "Medical officer (Slack)", "message": "Approved in Slack. surge_mode ON in Flagsmith."}`
5. **Send IM**: "Surge mode is on. RaktFlow is calling donors."

### Workflow B: "Voice worker rate-limited"
Trigger: **Webhook**. Put its URL in `NUDGEBEE_RATELIMIT_WEBHOOK_URL`.
1. **Query logs**: namespace `raktflow`, workload `voice-worker`, last 100 lines.
2. **AI Investigation**: "Voice workers report provider 429s. Correlate with max_concurrent_calls and recommend a value. `{{ Inputs.webhook_json }}`"
3. **Approval**: Slack.
4. **HTTP request**: lower the call limit in Flagsmith.
   - `PATCH .../features/<max_concurrent_calls id>/`
   - Body `{"environment_default": {"value": {"type": "integer", "value": "{{ Inputs.webhook_json.suggested_max_concurrent_calls }}"}}}`
5. **HTTP request**: `POST APP_URL/api/ops/nudgebee` with `{"message": "max_concurrent_calls lowered to {{ Inputs.webhook_json.suggested_max_concurrent_calls }} in Flagsmith, no redeploy."}`
