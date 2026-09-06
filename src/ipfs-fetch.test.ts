import { strict as assert } from "node:assert";
import test from "node:test";
import { fetchIpfsJson } from "./ipfs-fetch.js";

const source =
  "https://removed-gateway.invalid/ipfs/QmWaZ7imFJPcYDLPUykLycbtG2DhmYckqXMosFVWx9DUsN";

test("starts all four gateways and cancels the slower requests after valid JSON arrives", async () => {
  const requests: string[] = [];
  const signals: AbortSignal[] = [];
  const fetcher: typeof fetch = (input, init) => {
    requests.push(input instanceof Request ? input.url : input.toString());
    signals.push(init!.signal!);
    if (requests.length < 4) {
      return new Promise(() => {
        /* Simulate a stalled gateway. */
      });
    }
    return Promise.resolve(new Response('{"winner":true}'));
  };
  const result = await fetchIpfsJson(source, fetcher, 100);
  assert.equal(requests.length, 4);
  assert.equal(new URL(result.url).hostname, "gateway.ipfs.io");
  assert.equal(result.content, '{"winner":true}');
  assert.ok(signals.every((signal) => signal.aborted));
});

test("ignores a fast HTML redirect shell or HTTP error", async () => {
  for (const response of [
    new Response("<!doctype html><pre>loading</pre>"),
    new Response("{}", { status: 503 }),
  ]) {
    let count = 0;
    const fetcher: typeof fetch = () =>
      Promise.resolve(++count === 1 ? response : new Response('{"ok":true}'));
    assert.equal((await fetchIpfsJson(source, fetcher, 100)).content, '{"ok":true}');
  }
});

test("rejects when all gateways fail or time out", async () => {
  await assert.rejects(fetchIpfsJson(source, () => Promise.reject(new Error("offline")), 100));
  await assert.rejects(
    fetchIpfsJson(
      source,
      () =>
        new Promise(() => {
          /* Simulate a stalled gateway. */
        }),
      5,
    ),
  );
});

test("waits for a complete JSON body instead of choosing the first headers", async () => {
  let count = 0;
  const fetcher: typeof fetch = () =>
    Promise.resolve(
      ++count === 1 ? new Response(new ReadableStream()) : new Response('{"complete":true}'),
    );
  assert.equal((await fetchIpfsJson(source, fetcher, 100)).content, '{"complete":true}');
});

test("opens a successful image response without waiting for stalled gateways", async () => {
  const signals: AbortSignal[] = [];
  const fetcher: typeof fetch = (input, init) => {
    signals.push(init!.signal!);
    const url = input instanceof Request ? input.url : input.toString();
    if (url.startsWith("https://gateway.pinata.cloud/")) {
      return Promise.resolve(
        new Response(new ReadableStream(), { headers: { "Content-Type": "image/png" } }),
      );
    }
    return new Promise(() => {
      /* Other gateways are stalled. */
    });
  };
  const { fetchIpfsResource } = await import("./ipfs-fetch.js");
  const result = await fetchIpfsResource(source, fetcher, 100);
  assert.ok("media" in result);
  assert.equal(new URL(result.url).hostname, "gateway.pinata.cloud");
  assert.equal(signals.length, 4);
  assert.ok(signals.every((signal) => signal.aborted));
});
