# Dialiq

Dialiq is a Next.js MVP for a voice-first AI agent SaaS for businesses. The product is designed around reliable inbound voice handling for normal phone calls and WhatsApp calling, with grounded business knowledge, calendar booking, lead capture, and internal platform controls.

## What is in this repo

- A polished public entry page describing the product and architecture
- A business-facing workspace at `/workspace`
- An internal admin console at `/admin`
- A custom Next.js server that also hosts the realtime Twilio media gateway
- Realtime inbound Twilio voice handling with `/api/webhooks/twilio/voice` and `/realtime/twilio`
- Production-minded route utilities, environment validation, health checks, and security headers
- Unit tests and GitHub Actions CI for lint, test, and build verification
- MySQL-ready Prisma schema for core multi-tenant platform entities
- Admin-managed encrypted provider credentials backed by MySQL or environment fallbacks

## MVP scope represented here

- English only
- Voice only
- Inbound conversations only
- Twilio for phone and WhatsApp calling
- Deepgram Flux for realtime transcription and turn-taking
- OpenRouter routed to `gpt-5.4-mini` for grounded response composition
- ElevenLabs websocket streaming for low-latency voice synthesis
- Google Calendar OAuth and event creation for booking actions
- Google Calendar free/busy reads before live slot offers
- CRM lead capture as the next action layer
- Knowledge ingestion from website URLs, Markdown files, and PDF uploads

## Project structure

```text
src/
  app/
    api/
      platform/
      webhooks/twilio/voice/
    admin/
    workspace/
  components/
    layout/
    ui/
  lib/
    navigation.ts
    mock-data.ts
    platform.ts
    types.ts
    voice/pipeline.ts
```

## Key product decisions

- The business workspace and internal admin panel are intentionally separate.
- Structured data is treated as the trusted source for critical fields like price, duration, and booking rules.
- Provider credentials are represented in the admin UI only as masked values with health and rotation metadata.
- Provider credentials can come from runtime environment variables or encrypted MySQL storage managed in the admin panel.
- Booking and lead actions are modeled as confirm-first operations with explicit logging.
- Unstructured knowledge is stored as parsed documents and retrieval chunks so the voice layer can answer from uploaded business material.

## API routes

- `GET /api/health`
  Returns service status, mock-mode state, provider readiness, and database reachability.
- `GET /api/platform/workspace`
  Returns the live business workspace snapshot, falling back to seed data when MySQL is not configured.
- `GET /api/platform/admin`
  Returns the mocked internal admin snapshot.
- `GET /api/webhooks/twilio/voice`
  Returns route information, live readiness, and the realtime websocket path.
- `POST /api/webhooks/twilio/voice`
  Accepts JSON transcript payloads for simulation or Twilio form posts that receive TwiML for the realtime media stream.
- `GET /api/integrations/google/connect`
  Starts the Google Calendar OAuth flow for a workspace.
- `GET /api/integrations/google/callback`
  Completes Google Calendar OAuth and stores the encrypted refresh token in MySQL.

Example payload:

```json
{
  "tenantId": "atelier-workspace",
  "channel": "phone",
  "caller": "Elena Novak",
  "transcript": "Do you have any white desks under 200 euros?"
}
```

## Running locally

```bash
npm install
npm run db:generate
npm run dev
```

For live telephony you also need a public HTTPS/WSS URL. In local development, use a tunnel such as ngrok and set `NEXT_PUBLIC_APP_URL` to the public origin that Twilio can reach.

## Quality checks

```bash
npm run lint
npm run test
npm run build
```

## Database setup

Dialiq now includes a MySQL-backed Prisma schema for users, businesses, workspaces, agents, calls, bookings, leads, provider credentials, feature flags, and audit logs.

1. Copy `.env.example` to `.env.local`.
2. Set `DATABASE_URL` to your MySQL instance.
3. Set `APP_ENCRYPTION_KEY` to a strong secret. A 64-character hex key or a 32-byte base64 key is ideal.
4. Generate the Prisma client with `npm run db:generate`.
5. Push the schema with `npm run db:push` for local development or `npm run db:migrate` in deployed environments.

Once the database is reachable, the admin providers screen can store encrypted OpenRouter, Twilio, Deepgram, ElevenLabs, Google, and CRM credentials directly in MySQL.
Google Calendar workspace connections also rely on MySQL so encrypted refresh tokens can be stored safely.
The knowledge ingestion flow also relies on MySQL because uploaded documents, crawled website pages, and retrieval chunks are persisted there.

## Environment variables

Copy `.env.example` into `.env.local` and fill in real provider credentials when you are ready to replace the mocked services and UI data with live integrations.

- `DIALIQ_MOCK_MODE=true` keeps the webhook and health surface usable without live providers.
- `DIALIQ_ALLOW_INSECURE_TWILIO_SIGNATURE=true` is only for local development. Disable it in deployed environments so Twilio webhook and websocket signatures are enforced.
- `DIALIQ_DATABASE_TIMEOUT_MS`, `DIALIQ_PROVIDER_CONNECT_TIMEOUT_MS`, and `DIALIQ_REASONING_TIMEOUT_MS` bound infrastructure waits so the app degrades quickly instead of stalling.
- `OPENROUTER_MODEL` defaults to `openai/gpt-5.4-mini`.
- `ELEVENLABS_VOICE_ID` selects the live speaking voice used for Twilio playback.
- `GOOGLE_DEFAULT_CALENDAR_ID` defaults to `primary`.
- Provider credentials can be supplied through env vars, through the internal admin panel once MySQL is configured, or both. Database-managed credentials take precedence over env readiness in operational checks.
- When you wire production providers, disable mock mode and provide the required Twilio, Deepgram, OpenRouter, and ElevenLabs credentials.
- After schema changes like the knowledge document/chunk models, run `npm run db:push` before testing uploads or retrieval-backed answers.

## Next implementation steps

1. Add authentication and tenant-aware session handling.
2. Persist tenant-specific Twilio number mappings and Google Calendar settings from the business dashboard.
3. Add realtime interruption controls, silence detection tuning, and transcript replay tooling.
4. Extend the live integration layer with CRM write adapters, structured product imports, and provider-level health polling.
5. Add background jobs for recurring website sync, document reprocessing, transcript persistence, provider retries, and webhook replay.
