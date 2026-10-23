import { createServer } from "node:http";
import { connect as tcpConnect } from "node:net";
import { lookup } from "node:dns/promises";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { isPublicAddress, validatePublicUrl } from "./urls.mjs";

const MAX_TUNNELS = 512;
const CONNECT_TIMEOUT_MS = 12_000;
const DNS_TIMEOUT_MS = 7_000;
const IDLE_TIMEOUT_MS = 300_000;

function safeAuthority(authority) {
  if (typeof authority !== "string" || authority.length > 270 ||
    !/^\[[0-9a-fA-F:.]+\]:443$|^[a-zA-Z0-9.-]+:443$/.test(authority)) return null;
  try {
    const url = validatePublicUrl(`https://${authority}/`, { navigation: true });
    if (url.username || url.password || url.port && url.port !== "443") return null;
    return url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  } catch { return null; }
}

function deny(socket, status, extra = "") {
  if (socket.destroyed) return;
  socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n${extra}\r\n`);
}

/**
 * A fixed-function, loopback-only CONNECT proxy. Unlike a page request route,
 * it resolves at the actual outbound socket and dials the validated IP itself.
 * Browser redirects must open new CONNECT tunnels, so each redirected host is
 * checked again. No TLS contents, cookies or prompts are inspected or logged.
 */
export async function startOutboundProxy({
  resolve = (host) => lookup(host, { all: true, verbatim: true }),
  dial = (address, port) => tcpConnect({ host: address, port }),
} = {}) {
  if (typeof resolve !== "function" || typeof dial !== "function") {
    throw new Error("Invalid outbound proxy dependencies.");
  }
  const password = randomBytes(32).toString("base64url");
  const expectedAuth = Buffer.from(`Basic ${Buffer.from(`chatchat:${password}`).toString("base64")}`);
  const sockets = new Set();
  const inboundSockets = new Set();
  let closed = false;

  const server = createServer((_request, response) => {
    response.writeHead(403, { "Content-Length": "0", "Cache-Control": "no-store" });
    response.end();
  });
  server.maxConnections = MAX_TUNNELS + 32;
  // Include sockets that have not completed an HTTP request yet. Otherwise
  // a half-sent CONNECT can prevent close() from settling during app exit.
  server.on("connection", (socket) => {
    inboundSockets.add(socket);
    socket.on("error", () => socket.destroy());
    socket.once("close", () => inboundSockets.delete(socket));
    socket.setTimeout(IDLE_TIMEOUT_MS, () => socket.destroy());
  });
  server.headersTimeout = 12_000;
  server.requestTimeout = 12_000;
  server.on("clientError", (_error, socket) => socket.destroy());
  server.on("connect", async (request, client, head) => {
    // A browser disconnect, malformed CONNECT or rejected tunnel can emit
    // ECONNRESET. Never let that unhandled socket event terminate ChatChat.
    client.on("error", () => client.destroy());
    if (closed || sockets.size >= MAX_TUNNELS) {
      deny(client, "503 Service Unavailable");
      return;
    }
    const auth = request.headers["proxy-authorization"];
    const candidate = typeof auth === "string" ? Buffer.from(auth) : Buffer.alloc(0);
    if (candidate.length !== expectedAuth.length || !timingSafeEqual(candidate, expectedAuth)) {
      deny(client, "407 Proxy Authentication Required",
        'Proxy-Authenticate: Basic realm="ChatChat"\r\n');
      return;
    }
    const host = safeAuthority(request.url);
    if (!host) { deny(client, "403 Forbidden"); return; }
    const entry = { client, upstream: null };
    sockets.add(entry);
    client.once("close", () => {
      sockets.delete(entry);
      entry.upstream?.destroy();
    });
    client.setTimeout(IDLE_TIMEOUT_MS, () => client.destroy());
    try {
      // Bound DNS work: unresponsive resolvers must not occupy all tunnels.
      // Every resolved address is checked; connect directly to a checked IP.
      let dnsTimer;
      let answers;
      try {
        answers = await Promise.race([
          Promise.resolve().then(() => resolve(host)),
          new Promise((_, reject) => {
            dnsTimer = setTimeout(() => reject(new Error("DNS timeout")), DNS_TIMEOUT_MS);
          }),
        ]);
      } finally { clearTimeout(dnsTimer); }
      if (closed || !Array.isArray(answers) || !answers.length ||
        answers.some((item) => !item || !isPublicAddress(String(item.address ?? "")))) {
        deny(client, "403 Forbidden");
        return;
      }
      const chosen = String(answers[0].address);
      if (client.destroyed) return;
      // Crucially, use the checked IP, NEVER the original hostname.
      const upstream = dial(chosen, 443);
      entry.upstream = upstream;
      upstream.setTimeout?.(IDLE_TIMEOUT_MS, () => upstream.destroy());
      const timeout = setTimeout(() => upstream.destroy(), CONNECT_TIMEOUT_MS);
      upstream.once("connect", () => {
        clearTimeout(timeout);
        if (client.destroyed || closed) { upstream.destroy(); return; }
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head?.length) upstream.write(head);
        client.pipe(upstream);
        upstream.pipe(client);
      });
      upstream.once("error", () => {
        clearTimeout(timeout);
        if (!client.destroyed) deny(client, "502 Bad Gateway");
      });
      upstream.once("close", () => {
        clearTimeout(timeout);
        client.destroy();
      });
    } catch {
      deny(client, "502 Bad Gateway");
    }
  });
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); });
    });
  } catch (error) {
    server.close();
    throw error;
  }
  const address = server.address();
  if (!address || typeof address !== "object" || !Number.isInteger(address.port)) {
    server.close(); throw new Error("Outbound proxy did not bind to loopback.");
  }
  return {
    server: `http://127.0.0.1:${address.port}`,
    username: "chatchat",
    password,
    close: async () => {
      if (closed) return;
      closed = true;
      for (const entry of sockets) {
        entry.client.destroy();
        entry.upstream?.destroy();
      }
      for (const socket of inboundSockets) socket.destroy();
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}
