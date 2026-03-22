import { appConfig, env } from "@/lib/config/env";
import { logError } from "@/lib/observability/logger";
import { resolveProviderConfigValue } from "@/lib/repositories/provider-credentials";
import type { TranscriptTurn, VoiceCallMatch } from "@/lib/types";

interface ComposeGroundedVoiceReplyInput {
  callerTranscript: string;
  intent: string;
  fallbackResponse: string;
  trustedSources: string[];
  actionSummary: string;
  requiresHandoff: boolean;
  matches: VoiceCallMatch[];
  recentTurns: TranscriptTurn[];
}

interface OpenRouterChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

type OpenRouterMessageContent =
  | string
  | Array<{ type?: string; text?: string }>
  | undefined;

function readContent(content: OpenRouterMessageContent) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item?.text === "string" ? item.text : ""))
      .join("")
      .trim();
  }

  return "";
}

export async function composeGroundedVoiceReply(
  input: ComposeGroundedVoiceReplyInput,
) {
  const apiKey = await resolveProviderConfigValue("OPENROUTER_API_KEY");
  const model =
    (await resolveProviderConfigValue("OPENROUTER_MODEL")) ??
    env.OPENROUTER_MODEL ??
    "openai/gpt-5.4-mini";

  if (!apiKey) {
    return input.fallbackResponse;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), appConfig.reasoningTimeoutMs);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": appConfig.url.toString(),
        "X-Title": appConfig.name,
      },
      body: JSON.stringify({
        model,
        temperature: 0.15,
        max_tokens: 140,
        messages: [
          {
            role: "system",
            content:
              "You write short phone-call replies for a business voice agent. Use only the provided facts. Never invent missing prices, stock, delivery times, availability, policy terms, or booking details. Keep the reply under two short sentences, ask at most one follow-up question, and sound calm and businesslike. If handoff is required, say so clearly and briefly.",
          },
          {
            role: "user",
            content: JSON.stringify({
              conversationContext: input.recentTurns.slice(-4),
              callerTranscript: input.callerTranscript,
              intent: input.intent,
              trustedSources: input.trustedSources,
              actionSummary: input.actionSummary,
              requiresHandoff: input.requiresHandoff,
              matches: input.matches,
              fallbackResponse: input.fallbackResponse,
            }),
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenRouter returned ${response.status}.`);
    }

    const data = (await response.json()) as OpenRouterChatCompletionResponse;
    const content = readContent(data.choices?.[0]?.message?.content);

    return content || input.fallbackResponse;
  } catch (error) {
    logError("openrouter.compose_failed", error, {
      intent: input.intent,
    });
    return input.fallbackResponse;
  } finally {
    clearTimeout(timeout);
  }
}
