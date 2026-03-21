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
- Booking and lead actions are modeled as confirm-first operations with explicit logging.

## API routes

- `GET /api/health`
  Returns service status, mock-mode state, and provider readiness.
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
npm run dev
```

## Quality checks

```bash
npm run lint
npm run test
npm run build
```

## Environment variables

Copy `.env.example` into `.env.local` and fill in real provider credentials when you are ready to replace the mocked services and UI data with live integrations.

- `DIALIQ_MOCK_MODE=true` keeps the webhook and health surface usable without live providers.
- When you wire production providers, disable mock mode and provide the required Twilio, Deepgram, OpenRouter, and ElevenLabs credentials.

## Next implementation steps

1. Add authentication and tenant-aware session handling.
2. Introduce a real database layer for users, businesses, agents, calls, transcripts, sources, integrations, and audit logs.
3. Replace mocked provider states with actual provider validation and connection flows.
4. Wire the Twilio, Deepgram, OpenRouter, ElevenLabs, Google Calendar, and CRM adapters into the backend.
5. Add background jobs for ingestion, document sync, transcript persistence, and provider retries.
