import { createServer } from "node:http";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST ?? "localhost";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  // NOTE: The speaking module plan attaches a WebSocket upgrade handler here:
  //   server.on("upgrade", (req, socket, head) => { ... /ws/speaking ... });

  server.listen(port, hostname, () => {
    // eslint-disable-next-line no-console
    console.log(`> easyIELTS ready on http://${hostname}:${port} (${dev ? "dev" : "prod"})`);
  });
});
