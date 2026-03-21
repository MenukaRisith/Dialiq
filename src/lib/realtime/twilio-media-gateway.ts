import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";

import WebSocket, { WebSocketServer } from "ws";

import { appConfig } from "@/lib/config/env";
import { logError, logInfo, logWarn } from "@/lib/observability/logger";
import { DeepgramLiveTranscriber } from "@/lib/providers/deepgram-live";
import { ElevenLabsRealtimeStreamer } from "@/lib/providers/elevenlabs-live";
import { validateTwilioWebSocketRequest } from "@/lib/providers/twilio";
import { DEFAULT_TENANT_ID } from "@/lib/repositories/workspace-operations";
import { processInboundVoiceCall } from "@/lib/voice/pipeline";

interface TwilioStartMessage {
  event: "start";
  streamSid: string;
  start: {
    accountSid?: string;
    callSid?: string;
    customParameters?: Record<string, string>;
  };
}

interface TwilioMediaMessage {
  event: "media";
  streamSid: string;
  media: {
    payload: string;
    track?: string;
  };
}

interface TwilioMarkMessage {
  event: "mark";
  streamSid: string;
  mark: {
    name?: string;
  };
}

interface TwilioStopMessage {
  event: "stop";
  streamSid: string;
}

type TwilioInboundMessage =
  | TwilioStartMessage
  | TwilioMediaMessage
  | TwilioMarkMessage
  | TwilioStopMessage
  | { event?: string };

function safeJsonParse<T>(value: string) {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

class TwilioRealtimeSession {
  private streamSid?: string;
  private callSid?: string;
  private tenantId = DEFAULT_TENANT_ID;
  private caller = "Unknown caller";
  private channel: "phone" | "whatsapp-voice" = "phone";
  private deepgram = new DeepgramLiveTranscriber();
  private currentSynthesis?: ElevenLabsRealtimeStreamer;
  private currentMarkName?: string;
  private isProcessing = false;
  private pendingUtterance?: string;
  private closed = false;

  constructor(private readonly socket: WebSocket) {
    this.socket.on("message", (raw) => {
      this.handleSocketMessage(raw.toString());
    });

    this.socket.on("close", () => {
      this.close();
    });

    this.socket.on("error", (error) => {
      logError("twilio.gateway.socket_error", error, {
        callSid: this.callSid,
      });
      this.close();
    });

    this.deepgram.on("interim", () => {
      if (this.currentMarkName) {
        this.clearPlayback();
      }
    });

    this.deepgram.on("utterance", (text) => {
      void this.handleUtterance(text);
    });

    this.deepgram.on("error", (error) => {
      logError("twilio.gateway.deepgram_error", error, {
        callSid: this.callSid,
      });
      this.clearPlayback();
    });
  }

  private handleSocketMessage(raw: string) {
    const message = safeJsonParse<TwilioInboundMessage>(raw);

    if (!message?.event) {
      return;
    }

    switch (message.event) {
      case "start":
        this.handleStart(message as TwilioStartMessage);
        break;
      case "media":
        this.handleMedia(message as TwilioMediaMessage);
        break;
      case "mark":
        this.handleMark(message as TwilioMarkMessage);
        break;
      case "stop":
        this.close();
        break;
      default:
        break;
    }
  }

  private handleStart(message: TwilioStartMessage) {
    this.streamSid = message.streamSid;
    this.callSid = message.start.callSid;
    this.tenantId = message.start.customParameters?.tenantId ?? DEFAULT_TENANT_ID;
    this.caller = message.start.customParameters?.caller ?? "Unknown caller";
    this.channel =
      message.start.customParameters?.channel === "whatsapp-voice"
        ? "whatsapp-voice"
        : "phone";

    this.deepgram.connect();

    logInfo("twilio.gateway.session_started", {
      streamSid: this.streamSid,
      callSid: this.callSid,
      tenantId: this.tenantId,
      channel: this.channel,
    });
  }

  private handleMedia(message: TwilioMediaMessage) {
    if (!message.media?.payload) {
      return;
    }

    this.deepgram.sendAudio(message.media.payload);
  }

  private handleMark(message: TwilioMarkMessage) {
    if (message.mark?.name && message.mark.name === this.currentMarkName) {
      this.currentMarkName = undefined;
    }
  }

  private async handleUtterance(text: string) {
    if (!text.trim()) {
      return;
    }

    if (this.isProcessing) {
      this.pendingUtterance = text;
      return;
    }

    this.isProcessing = true;

    try {
      const result = await processInboundVoiceCall({
        tenantId: this.tenantId,
        channel: this.channel,
        caller: this.caller,
        transcript: text,
        callId: this.callSid,
      });

      await this.streamReply(result.responseText);
    } catch (error) {
      logError("twilio.gateway.process_failed", error, {
        callSid: this.callSid,
        tenantId: this.tenantId,
      });
      await this.streamReply(
        "I hit a connection issue, so the safest next step is a callback from the team.",
      );
    } finally {
      this.isProcessing = false;

      if (this.pendingUtterance) {
        const queuedUtterance = this.pendingUtterance;
        this.pendingUtterance = undefined;
        void this.handleUtterance(queuedUtterance);
      }
    }
  }

  private async streamReply(text: string) {
    if (!this.streamSid || !text.trim()) {
      return;
    }

    this.clearPlayback();

    const streamer = new ElevenLabsRealtimeStreamer();
    this.currentSynthesis = streamer;
    const markName = `reply-${Date.now()}`;
    this.currentMarkName = markName;

    streamer.on("audio", (audio) => {
      this.sendToTwilio({
        event: "media",
        streamSid: this.streamSid,
        media: {
          payload: audio,
        },
      });
    });

    streamer.on("error", (error) => {
      logError("twilio.gateway.tts_failed", error, {
        callSid: this.callSid,
      });
    });

    await streamer.speak(text);

    if (this.streamSid) {
      this.sendToTwilio({
        event: "mark",
        streamSid: this.streamSid,
        mark: {
          name: markName,
        },
      });
    }
  }

  private clearPlayback() {
    if (this.streamSid) {
      this.sendToTwilio({
        event: "clear",
        streamSid: this.streamSid,
      });
    }

    this.currentMarkName = undefined;
    this.currentSynthesis?.close();
    this.currentSynthesis = undefined;
  }

  private sendToTwilio(payload: Record<string, unknown>) {
    if (this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(payload));
  }

  private close() {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.clearPlayback();
    this.deepgram.close();

    if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
      this.socket.close();
    }
  }
}

export function createTwilioMediaGateway() {
  const gateway = new WebSocketServer({
    noServer: true,
  });

  gateway.on("connection", (socket) => {
    new TwilioRealtimeSession(socket);
  });

  return {
    async handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
      const signature = req.headers["x-twilio-signature"];
      const normalizedSignature = Array.isArray(signature) ? signature[0] : signature;
      const requestUrl = new URL(req.url ?? "/realtime/twilio", appConfig.url).toString();

      if (!validateTwilioWebSocketRequest(requestUrl, normalizedSignature)) {
        logWarn("twilio.gateway.invalid_signature", {
          requestUrl,
        });
        socket.destroy();
        return;
      }

      gateway.handleUpgrade(req, socket, head, (client) => {
        gateway.emit("connection", client, req);
      });
    },
  };
}
