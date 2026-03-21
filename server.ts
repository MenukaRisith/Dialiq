import { createServer } from "node:http";

import next from "next";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST ?? process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? "3000");

async function main() {
  const { createTwilioMediaGateway } = await import(
    "./src/lib/realtime/twilio-media-gateway"
  );
  const app = next({
    dev,
    hostname,
    port,
  });

  await app.prepare();

  const requestHandler = app.getRequestHandler();
  const upgradeHandler = app.getUpgradeHandler();
  const twilioGateway = createTwilioMediaGateway();

  const server = createServer(async (req, res) => {
    await requestHandler(req, res);
  });

  server.on("upgrade", async (req, socket, head) => {
    if (req.url?.startsWith("/realtime/twilio")) {
      await twilioGateway.handleUpgrade(req, socket, head);
      return;
    }

    await upgradeHandler(req, socket, head);
  });

  server.listen(port, hostname, () => {
    console.info(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        event: "server.started",
        dev,
        port,
        hostname,
      }),
    );
  });
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
