import test from "node:test";
import assert from "node:assert/strict";
import { createServer as tcpServer, connect, Socket } from "node:net";
import { startOutboundProxy } from "../runtime/outbound-proxy.mjs";

function waitListen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}

async function connectRequest(proxy, authority, { auth = true, text } = {}) {
  const url = new URL(proxy.server);
  const authorization = `Basic ${Buffer.from(`${proxy.username}:${proxy.password}`).toString("base64")}`;
  return new Promise((resolve, reject) => {
    const client = connect(Number(url.port), "127.0.0.1");
    let result = "";
    const timer = setTimeout(() => { client.destroy(); reject(new Error("Proxy test timed out")); }, 5000);
    client.on("error", (error) => { clearTimeout(timer); reject(error); });
    client.on("connect", () => client.write(
      `CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n${auth ? `Proxy-Authorization: ${authorization}\r\n` : ""}\r\n`
    ));
    client.on("data", (chunk) => {
      result += chunk.toString("utf8");
      if (result.includes("200 Connection Established") && text && !result.includes(text)) {
        if (!result.includes("\r\n\r\nSENT\r\n")) {
          text = null;
          client.write("echo-me");
        }
      }
      if (/HTTP\/1\.1 (?!200)\d+ /.test(result) || (result.includes("200 Connection Established") && result.includes("echo-me"))) {
        clearTimeout(timer); client.destroy(); resolve(result);
      }
    });
    client.on("end", () => {
      clearTimeout(timer); resolve(result);
    });
  });
}

test("a loopback-authenticated tunnel connects ONLY to the verified public IP", async (t) => {
  const relay = tcpServer((socket) => socket.pipe(socket));
  const echoPort = await waitListen(relay);
  t.after(() => new Promise((resolve) => relay.close(resolve)));
  let dialed = [];
  const proxy = await startOutboundProxy({
    resolve: async () => [{ address: "8.8.8.8" }],
    dial: (address, port) => {
      dialed.push({ address, port });
      return connect(echoPort, "127.0.0.1");
    },
  });
  t.after(() => proxy.close());
  assert.match(proxy.server, /^http:\/\/127\.0\.0\.1:\d+$/);
  const noAuth = await connectRequest(proxy, "example.com:443", { auth: false });
  assert.match(noAuth, /407 Proxy Authentication Required/);
  assert.equal(dialed.length, 0);
  const badPort = await connectRequest(proxy, "example.com:80");
  assert.match(badPort, /403 Forbidden/);
  assert.equal(dialed.length, 0);
  const result = await connectRequest(proxy, "example.com:443", { text: "echo-me" });
  assert.match(result, /200 Connection Established/);
  assert.match(result, /echo-me/);
  assert.deepEqual(dialed, [{ address: "8.8.8.8", port: 443 }]);
});

test("redirected and DNS-rebound destinations cannot create unsafe tunnels", async (t) => {
  let lookupCount = 0;
  let dials = 0;
  const proxy = await startOutboundProxy({
    resolve: async () => (++lookupCount === 1
      ? [{ address: "1.1.1.1" }] : [{ address: "127.0.0.1" }]),
    dial: () => { dials++; const socket = new Socket(); queueMicrotask(() => socket.emit("error", new Error("fixture dial failure"))); return socket; },
  });
  t.after(() => proxy.close());
  const response = await connectRequest(proxy, "127.0.0.1:443");
  assert.match(response, /403 Forbidden/);
  assert.equal(lookupCount, 0, "Direct localhost CONNECT must be rejected before DNS");
  const privateIp6 = await connectRequest(proxy, "[::1]:443");
  assert.match(privateIp6, /403 Forbidden/);
  assert.equal(lookupCount, 0);
  // First hostname resolution passes the public-address policy; using an
  // invalid dial fixture must still not silently fall back to DNS-by-host.
  const first = await connectRequest(proxy, "safe.example:443");
  assert.match(first, /502 Bad Gateway/);
  assert.equal(dials, 1);
  const rebound = await connectRequest(proxy, "safe.example:443");
  assert.match(rebound, /403 Forbidden/);
  assert.equal(lookupCount, 2);
  assert.equal(dials, 1, "No socket should be opened for rebound private DNS");
});

test("mixed public/private DNS answers and normal HTTP proxy requests fail closed", async (t) => {
  let called = false;
  const proxy = await startOutboundProxy({
    resolve: async () => [{ address: "1.1.1.1" }, { address: "192.168.1.1" }],
    dial: () => { called = true; throw new Error("Dial forbidden"); },
  });
  t.after(() => proxy.close());
  assert.match(await connectRequest(proxy, "safe.example:443"), /403 Forbidden/);
  assert.equal(called, false);
  const url = new URL(proxy.server);
  const request = await new Promise((resolve, reject) => {
    const client = connect(Number(url.port), "127.0.0.1");
    let data = "";
    client.on("connect", () => client.write("GET http://127.0.0.1/ HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n"));
    client.on("data", (chunk) => { data += chunk.toString(); if (data.includes("\r\n\r\n")) { client.destroy(); resolve(data); } });
    client.on("end", () => resolve(data));
    client.on("error", reject);
  });
  assert.match(request, /403 Forbidden/);
});

test("proxy shutdown terminates half-sent client connections without hanging", async () => {
  const proxy = await startOutboundProxy();
  const address = new URL(proxy.server);
  const client = connect(Number(address.port), "127.0.0.1");
  let connected;
  await new Promise((resolve, reject) => {
    client.once("connect", () => {
      connected = true;
      // Intentionally omit the final header terminator.
      client.write("CONNECT example.com:443 HTTP/1.1\r\nHost: example.com:443\r\n");
      resolve();
    });
    client.once("error", reject);
  });
  assert.equal(connected, true);
  const clientClosed = new Promise((resolve) => client.once("close", resolve));
  const stopped = await Promise.race([
    proxy.close().then(() => "closed"),
    new Promise((resolve) => setTimeout(() => resolve("hung"), 1_500)),
  ]);
  assert.equal(stopped, "closed", "Incomplete HTTP parser state must never pin app exit");
  const didClose = await Promise.race([
    clientClosed.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 1_500)),
  ]);
  assert.equal(didClose, true, 'Client sees the server-side socket shutdown');
  assert.equal(client.destroyed, true);
});
