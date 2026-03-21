import { simulateInboundVoiceCall, voiceWebhookSchema } from "@/lib/voice/pipeline";

export async function GET() {
  return Response.json({
    route: "/api/webhooks/twilio/voice",
    method: "POST",
    description:
      "Mock inbound voice webhook for Dialiq. Validates the inbound payload and simulates the trusted voice-agent pipeline response.",
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = voiceWebhookSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid payload",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const result = await simulateInboundVoiceCall(parsed.data);
  return Response.json(result);
}
