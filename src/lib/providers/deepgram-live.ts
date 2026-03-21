import { EventEmitter } from "node:events";

import { appConfig, env } from "@/lib/config/env";
import { logError, logWarn } from "@/lib/observability/logger";
import WebSocket from "ws";

interface DeepgramResultMessage {
  type?: string;
  is_final?: boolean;
  speech_final?: boolean;
  channel?: {
    alternatives?: Array<{
      transcript?: string;
    }>;
  };
}

export interface DeepgramLiveTranscriberEvents {
  interim: [text: string];
  utterance: [text: string];
  close: [];
  error: [error: Error];
}

export class DeepgramLiveTranscriber extends EventEmitter<DeepgramLiveTranscriberEvents> {
  private socket?: WebSocket;
  private finalChunks: string[] = [];
  private pendingAudio: Buffer[] = [];
  private connectTimeout?: NodeJS.Timeout;

  connect() {
    if (!env.DEEPGRAM_API_KEY) {
      throw new Error("DEEPGRAM_API_KEY is required for realtime transcription.");
    }

    const url = new URL("wss://api.deepgram.com/v2/listen");
    url.searchParams.set("model", "flux-general-en");
    url.searchParams.set("encoding", "mulaw");
    url.searchParams.set("sample_rate", "8000");
    url.searchParams.set("channels", "1");
    url.searchParams.set("interim_results", "true");
    url.searchParams.set("endpointing", "300");
    url.searchParams.set("punctuate", "true");
    url.searchParams.set("smart_format", "true");

    this.socket = new WebSocket(url, {
      headers: {
        Authorization: `Token ${env.DEEPGRAM_API_KEY}`,
      },
    });

    this.connectTimeout = setTimeout(() => {
      this.emit("error", new Error("Deepgram realtime connection timed out."));
      this.close();
    }, appConfig.providerConnectTimeoutMs);
    this.connectTimeout.unref?.();

    this.socket.on("open", () => {
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = undefined;
      }

      for (const chunk of this.pendingAudio) {
        this.socket?.send(chunk);
      }

      this.pendingAudio = [];
    });

    this.socket.on("message", (value) => {
      this.handleMessage(value.toString());
    });

    this.socket.on("close", () => {
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = undefined;
      }
      this.emit("close");
    });

    this.socket.on("error", (error) => {
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = undefined;
      }
      logError("deepgram.realtime.error", error, {});
      this.emit("error", error instanceof Error ? error : new Error(String(error)));
    });
  }

  sendAudio(base64Payload: string) {
    const buffer = Buffer.from(base64Payload, "base64");

    if (!this.socket || this.socket.readyState === WebSocket.CONNECTING) {
      this.pendingAudio.push(buffer);
      return;
    }

    if (this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(buffer);
  }

  finalize() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify({ type: "Finalize" }));
  }

  close() {
    if (!this.socket) {
      return;
    }

    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = undefined;
    }

    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "CloseStream" }));
    }

    this.socket.close();
  }

  private handleMessage(payload: string) {
    let message: DeepgramResultMessage;

    try {
      message = JSON.parse(payload) as DeepgramResultMessage;
    } catch (error) {
      logWarn("deepgram.realtime.invalid_json", {
        payload,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    const transcript = message.channel?.alternatives?.[0]?.transcript?.trim();

    if (!transcript) {
      return;
    }

    if (message.is_final) {
      this.finalChunks.push(transcript);
    } else {
      this.emit("interim", transcript);
    }

    if (message.speech_final) {
      const utterance = this.finalChunks.join(" ").trim() || transcript;
      this.finalChunks = [];

      if (utterance) {
        this.emit("utterance", utterance);
      }
    }
  }
}
