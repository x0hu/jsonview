import { strict as assert } from "node:assert";
import test from "node:test";
import { normalizeGateway } from "./gateway-settings.js";
import { ipfsRawGatewayUrls } from "./ipfs.js";
import { fetchIpfsResource } from "./ipfs-fetch.js";

const source = "ipfs://QmWaZ7imFJPcYDLPUykLycbtG2DhmYckqXMosFVWx9DUsN/folder/meta.json?filename=meta.json";

test("normalizes gateway bases while retaining provider path prefixes", () => {
  assert.equal(normalizeGateway(" https://custom.example/ipfs/ "), "https://custom.example");
  assert.equal(normalizeGateway("https://custom.example/private/ipfs"), "https://custom.example/private");
  assert.equal(normalizeGateway(" "), undefined);
});

test("rejects unsafe schemes, credentials and content URLs", () => {
  for (const value of ["http://custom.example", "javascript:alert(1)", "https://user:pass@custom.example", "https://custom.example?token=secret", "https://custom.example/#fragment", "https://custom.example/ipfs/CID", "not a URL"]) {
    assert.throws(() => normalizeGateway(value));
  }
});

test("adds only the custom destination and deduplicates public gateways", () => {
  const publicUrls = ipfsRawGatewayUrls(source);
  assert.deepEqual(ipfsRawGatewayUrls(source, "https://ipfs.io/ipfs"), publicUrls);
  assert.deepEqual(ipfsRawGatewayUrls(source, "javascript:alert(1)"), publicUrls);
  const urls = ipfsRawGatewayUrls(source, "https://custom.example/private/ipfs");
  assert.deepEqual(urls.slice(0, 3), publicUrls);
  assert.equal(urls[3], "https://custom.example/private/ipfs/QmWaZ7imFJPcYDLPUykLycbtG2DhmYckqXMosFVWx9DUsN/folder/meta.json?filename=meta.json");
});

test("a custom gateway can win the race and cancel stalled public requests", async () => {
  const signals: AbortSignal[] = [];
  const fetcher: typeof fetch = (input, init) => {
    signals.push(init!.signal!);
    if ((input instanceof Request ? input.url : input.toString()).startsWith("https://custom.example/")) {
      return Promise.resolve(new Response('{"custom":true}'));
    }
    return new Promise(() => { /* Simulate a stalled public gateway. */ });
  };
  const result = await fetchIpfsResource(source, fetcher, 100, undefined, "https://custom.example");
  assert.ok("json" in result);
  assert.equal(new URL(result.url).hostname, "custom.example");
  assert.equal(signals.length, 4);
  assert.ok(signals.every((signal) => signal.aborted));
});

test("a failed custom gateway does not prevent a public gateway winning", async () => {
  const fetcher: typeof fetch = (input) => (input instanceof Request ? input.url : input.toString()).startsWith("https://custom.example/")
    ? Promise.reject(new Error("offline"))
    : Promise.resolve(new Response('{"public":true}'));
  const result = await fetchIpfsResource(source, fetcher, 100, undefined, "https://custom.example");
  assert.ok("json" in result);
  assert.notEqual(new URL(result.url).hostname, "custom.example");
});
