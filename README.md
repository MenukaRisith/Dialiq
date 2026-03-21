# Dialiq

Dialiq is a Next.js MVP for a voice-first AI agent SaaS for businesses. The product is designed around reliable inbound voice handling for normal phone calls and WhatsApp calling, with grounded business knowledge, calendar booking, lead capture, and internal platform controls.

## What is in this repo

- A polished public entry page describing the product and architecture
- A business-facing workspace at `/workspace`
- An internal admin console at `/admin`
- Mocked platform data and API routes that model the core MVP entities
- A simulated inbound Twilio voice webhook at `/api/webhooks/twilio/voice`
- Production-minded route utilities, environment validation, health checks, and security headers
- Unit tests and GitHub Actions CI for lint, test, and build verification
- MySQL-ready Prisma schema for core multi-tenant platform entities
- Admin-managed encrypted provider credentials backed by MySQL or environment fallbacks

## MVP scope represented here

- English only
- Voice only
- Inbound conversations only
- Twilio for phone and WhatsApp calling
- Deepgram Flux for transcription and turn-taking
- OpenRouter routed to `gpt-5.4-mini` for reasoning
- ElevenLabs for voice synthesis
- Google Calendar for booking actions
- CRM lead capture as the next action layer

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

## API routes

- `GET /api/health`
  Returns service status, mock-mode state, provider readiness, and database reachability.
- `GET /api/platform/workspace`
  Returns the mocked business workspace snapshot.
- `GET /api/platform/admin`
  Returns the mocked internal admin snapshot.
- `GET /api/webhooks/twilio/voice`
  Returns basic route information.
- `POST /api/webhooks/twilio/voice`
  Accepts a mock inbound voice payload and returns a simulated trusted response plan.

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

## Environment variables

Copy `.env.example` into `.env.local` and fill in real provider credentials when you are ready to replace the mocked services and UI data with live integrations.

- `DIALIQ_MOCK_MODE=true` keeps the webhook and health surface usable without live providers.
- Provider credentials can be supplied through env vars, through the internal admin panel once MySQL is configured, or both. Database-managed credentials take precedence over env readiness in operational checks.
- When you wire production providers, disable mock mode and provide the required Twilio, Deepgram, OpenRouter, and ElevenLabs credentials.

## Next implementation steps

1. Add authentication and tenant-aware session handling.
2. Persist live call transcripts, bookings, leads, and tenant configuration into MySQL instead of mock snapshots.
3. Replace provider health placeholders with live validation checks per integration.
4. Wire the Twilio, Deepgram, OpenRouter, ElevenLabs, Google Calendar, and CRM adapters into the backend.
5. Add background jobs for ingestion, document sync, transcript persistence, provider retries, and webhook replay.
