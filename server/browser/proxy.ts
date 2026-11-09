// Loopback HTTP proxy for the browser. Every request the browser makes,
// including loopback ones (Chromium is told not to bypass the proxy), goes
// through here; destinations that are not public addresses are refused, and the
// proxy connects to the address it checked, so DNS rebinding cannot slip past.
import { createServer, request, type IncomingMessage, type ServerResponse } from "node:http";
import { connect, type AddressInfo, type Socket } from "node:net";
import { resolvePublic } from "../netGuard.ts";

const ALLOWED_PORTS = new Set([80, 443]);

export interface GuardProxy {
  url: string;
  close: () => void;
}

export function startGuardProxy(): Promise<GuardProxy> {
  const server = createServer((req, res) => void forward(req, res));
  server.on("connect", (req: IncomingMessage, client: Socket, head: Buffer) => {
    void tunnel(req, client, head);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });
}

/** HTTPS and WebSocket traffic: CONNECT host:port, then a raw tunnel. */
async function tunnel(req: IncomingMessage, client: Socket, head: Buffer) {
  client.on("error", () => client.destroy());
  const match = /^\[?([^\]]+?)\]?:(\d+)$/.exec(req.url ?? "");
  const port = Number(match?.[2]);
  const address =
    match?.[1] && ALLOWED_PORTS.has(port) ? await resolvePublic(match[1]).catch(() => "") : "";
  if (!address) {
    client.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    return;
  }
  const upstream = connect(port, address, () => {
    client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    upstream.write(head);
    upstream.pipe(client);
    client.pipe(upstream);
  });
  upstream.on("error", () => client.destroy());
  client.on("close", () => upstream.destroy());
}

/** Plain HTTP: the browser sends the absolute URL. */
async function forward(req: IncomingMessage, res: ServerResponse) {
  const target = URL.canParse(req.url ?? "") ? new URL(req.url ?? "") : undefined;
  const port = Number(target?.port || 80);
  const address =
    target?.protocol === "http:" && ALLOWED_PORTS.has(port)
      ? await resolvePublic(target.hostname).catch(() => "")
      : "";
  if (!target || !address) {
    res.writeHead(403).end();
    return;
  }
  const upstream = request(
    {
      host: address,
      port,
      method: req.method,
      path: `${target.pathname}${target.search}`,
      headers: { ...req.headers, host: target.host },
    },
    (answer) => {
      res.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(res);
    },
  );
  upstream.on("error", () => (res.headersSent ? res.destroy() : res.writeHead(502).end()));
  req.pipe(upstream);
}
