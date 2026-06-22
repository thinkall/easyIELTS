import { createServer } from "node:http";
import { loadEnvConfig } from "@next/env";
import next from "next";
import { attachSpeakingProxy } from "@/server/speaking-proxy";

process.on("uncaughtException", (err) => {
  console.error("[easyIELTS] uncaught exception:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("[easyIELTS] unhandled rejection:", err);
});

const dev = process.env.NODE_ENV !== "production";

// Load .env files (e.g. .env.local) into process.env BEFORE reading any vars,
// so the custom server honors env-file config (PORT/HOST and owner API keys)
// the same way the Next.js runtime does.
loadEnvConfig(process.cwd(), dev);

const hostname = process.env.HOST ?? "localhost";
const parsedPort = Number.parseInt(process.env.PORT ?? "3000", 10);
const port = Number.isNaN(parsedPort) ? 3000 : parsedPort;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = createServer((req, res) => {
      handle(req, res);
    });

    // Live speaking proxy: browser <-> our server <-> Gemini Live (key stays server-side).
    attachSpeakingProxy(server);

    server.on("error", (err) => {
      console.error("[easyIELTS] server error:", err);
      process.exit(1);
    });

    server.listen(port, hostname, () => {
      console.log(`> easyIELTS ready on http://${hostname}:${port} (${dev ? "dev" : "prod"})`);
    });
  })
  .catch((err) => {
    console.error("[easyIELTS] failed to start:", err);
    process.exit(1);
  });
