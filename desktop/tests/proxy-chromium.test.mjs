import test from "node:test";
import assert from "node:assert/strict";
import { Socket, createServer } from "node:net";
import { chromium } from "playwright-core";
import { startOutboundProxy } from "../runtime/outbound-proxy.mjs";

const executablePath = process.env.CHATCHAT_RENDERER_BROWSER;
const skip = executablePath ? false : "Requires an explicitly provided local sandboxed Chromium binary.";

test("real Chromium authenticates through the IP-pinned proxy and cannot bypass it for loopback", { skip }, async (t) => {
  let verifiedConnects = 0;
  let privateLookups = 0;
  let directLocalConnections = 0;
  const privateEndpoint = createServer((socket) => {
    directLocalConnections++;
    socket.end();
  });
  await new Promise((resolve) => privateEndpoint.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => privateEndpoint.close(resolve)));
  const port = privateEndpoint.address().port;
  const proxy = await startOutboundProxy({
    resolve: async (host) => {
      if (host !== "council-fixture.example") {
        if (host === "127.0.0.1" || host === "localhost") privateLookups++;
        return [{ address: "127.0.0.1" }];
      }
      return [{ address: "1.1.1.1" }];
    },
    dial: (address, targetPort) => {
      assert.equal(address, "1.1.1.1");
      assert.equal(targetPort, 443);
      verifiedConnects++;
      const socket = new Socket();
      queueMicrotask(() => socket.emit("error", new Error("Controlled test handshake failure")));
      return socket;
    },
  });
  t.after(() => proxy.close());
  const browser = await chromium.launch({
    executablePath, headless: true, chromiumSandbox: true,
    proxy: { server: proxy.server, username: proxy.username, password: proxy.password },
    args: ["--proxy-bypass-list=<-loopback>", "--disable-quic",
      "--force-webrtc-ip-handling-policy=disable_non_proxied_udp"],
  });
  t.after(() => browser.close());

  const page = await browser.newPage();
  await assert.rejects(page.goto("https://council-fixture.example/", { timeout: 12_000 }),
    /ERR_|Timeout|net::|failed/i);
  assert.ok(verifiedConnects >= 1, "Chromium must pass through the authenticated proxy");

  await assert.rejects(page.goto(`https://127.0.0.1:${port}/`, { timeout: 10_000 }),
    /ERR_|Timeout|net::|failed/i);
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(directLocalConnections, 0, "Loopback traffic must not bypass the HTTPS-only proxy");
  assert.equal(privateLookups, 0, "Literal private destinations are rejected before DNS");
});
