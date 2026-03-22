import { EventEmitter } from "node:events";

import { appConfig, env } from "@/lib/config/env";
import { logError, logWarn } from "@/lib/observability/logger";
import { resolveProviderConfigValue } from "@/lib/repositories/provider-credentials";
import WebSocket from "ws";

export interface ElevenLabsStreamerEvents {
  audio: [base64Payload: string];
  done: [];
  error: [error: Error];
}

interface ElevenLabsAudioMessage {
  audio?: string;
  isFinal?: boolean;
}

export class ElevenLabsRealtimeStreamer extends EventEmitter<ElevenLabsStreamerEvents> {
  private socket?: WebSocket;
  private connectTimeout?: NodeJS.Timeout;

  async speak(text: string) {
    const apiKey = await resolveProviderConfigValue("ELEVENLABS_API_KEY");
    const voiceId =
      (await resolveProviderConfigValue("ELEVENLABS_VOICE_ID")) ??
      env.ELEVENLABS_VOICE_ID ??
      "EXAVITQu4vr4xnSDxMaL";
    const modelId =
      (await resolveProviderConfigValue("ELEVENLABS_MODEL_ID")) ??
      env.ELEVENLABS_MODEL_ID ??
      "eleven_flash_v2_5";

    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY is required for realtime synthesis.");
    }

    const url = new URL(
      `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input`,
    );
    url.searchParams.set("model_id", modelId);
    url.searchParams.set("output_format", "ulaw_8000");
    url.searchParams.set("auto_mode", "true");
    url.searchParams.set("sync_alignment", "false");

    this.socket = new WebSocket(url, {
      headers: {
        "xi-api-key": apiKey,
      },
    });

    return new Promise<void>((resolve, reject) => {
      if (!this.socket) {
        reject(new Error("ElevenLabs websocket was not created."));
        return;
      }

      this.connectTimeout = setTimeout(() => {
        const error = new Error("ElevenLabs realtime connection timed out.");
        this.emit("error", error);
        this.close();
        reject(error);
      }, appConfig.providerConnectTimeoutMs);
      this.connectTimeout.unref?.();

      this.socket.on("open", () => {
        if (this.connectTimeout) {
          clearTimeout(this.connectTimeout);
          this.connectTimeout = undefined;
        }

        this.socket?.send(
          JSON.stringify({
            text: " ",
            voice_settings: {
              stability: 0.35,
              similarity_boost: 0.72,
              speed: 1,
            },
            generation_config: {
              chunk_length_schedule: [80, 120, 160],
            },
          }),
        );
        this.socket?.send(JSON.stringify({ text }));
        this.socket?.send(JSON.stringify({ text: "" }));
      });

      this.socket.on("message", (value) => {
        this.handleMessage(value.toString());
      });

      this.socket.on("close", () => {
        if (this.connectTimeout) {
          clearTimeout(this.connectTimeout);
          this.connectTimeout = undefined;
        }
        this.emit("done");
        resolve();
      });

      this.socket.on("error", (error) => {
        if (this.connectTimeout) {
          clearTimeout(this.connectTimeout);
          this.connectTimeout = undefined;
        }
        logError("elevenlabs.realtime.error", error, {});
        const normalized = error instanceof Error ? error : new Error(String(error));
        this.emit("error", normalized);
        reject(normalized);
      });
    });
  }

  close() {
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = undefined;
    }

    this.socket?.close();
  }

  private handleMessage(payload: string) {
    let message: ElevenLabsAudioMessage;

    try {
      message = JSON.parse(payload) as ElevenLabsAudioMessage;
    } catch (error) {
      logWarn("elevenlabs.realtime.invalid_json", {
        payload,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    if (message.audio) {
      this.emit("audio", message.audio);
    }

    if (message.isFinal) {
      this.socket?.close();
    }
  }
}
