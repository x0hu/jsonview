import { strict as assert } from "node:assert";
import test from "node:test";
import { requestIpfsForViewer } from "./ipfs-viewer-request.js";

const source = "https://ipfs.io/ipfs/QmXf6PSFqDWb7r6RfwU6yoBadUA1LHwkL5HPrspEgWqzaB";
const ignoreProgress = () => {
  /* These tests assert the outcome of the attempt. */
};
const challenge = () =>
  new Response("Browser check", { status: 403, headers: { "cf-mitigated": "challenge" } });

test("opens verification within 150ms of a challenge instead of waiting for stalled gateways", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const signals: AbortSignal[] = [];
  let settled = false;
  const request = requestIpfsForViewer(source, ignoreProgress, (input, init) => {
    signals.push(init!.signal!);
    return input === source ? Promise.resolve(challenge()) : new Promise(() => {
      /* Other gateways never respond. */
    });
  }).then((result) => { settled = true; return result; });
  await new Promise((resolve) => setImmediate(resolve));
  try {
    context.mock.timers.tick(149);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(settled, false, "give fast content a brief chance to win");
    context.mock.timers.tick(1);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(settled, true, "verification must not wait for the five-second request timeout");
    assert.deepEqual(await request, { verificationRequired: true, verificationUrl: source });
    assert.ok(signals.every((signal) => signal.aborted));
  } finally {
    context.mock.timers.tick(5000);
    await request;
  }
});

test("uses the linked QuickNode gateway when public gateways require verification or stall", async () => {
  const linkedUrl =
    "https://eye-order-disease.quicknode-ipfs.com/ipfs/QmThc3Tw1WwU2Y3Lz4omcjmAMvdMbwN8FXcfkA67YD2xtC";
  const result = await requestIpfsForViewer(linkedUrl, ignoreProgress, (input) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url === linkedUrl) {
      return Promise.resolve(new Response('{"name":"Stockx"}'));
    }
    if (url.includes("pinata")) {
      return new Promise(() => {
        /* The public gateway stalls while the linked gateway has the content. */
      });
    }
    return Promise.resolve(challenge());
  }, 25);
  assert.ok("content" in result);
  assert.equal(result.content, '{"name":"Stockx"}');
  assert.equal(result.url, linkedUrl);
});

test("selects a browser check when another gateway times out", async () => {
  let calls = 0;
  const signals: AbortSignal[] = [];
  const result = await requestIpfsForViewer(
    source,
    ignoreProgress,
    (_url, init) => {
      signals.push(init!.signal!);
      return ++calls === 1
        ? Promise.resolve(challenge())
        : new Promise(() => {
            /* Stalled gateway. */
          });
    },
    10,
  );
  assert.deepEqual(result, { verificationRequired: true, verificationUrl: source });
  assert.ok(signals.every((signal) => signal.aborted));
});

test("still uses an available gateway when another one needs verification", async () => {
  let calls = 0;
  const result = await requestIpfsForViewer(source, ignoreProgress, () =>
    Promise.resolve(++calls === 1 ? challenge() : new Response('{"ready":true}')),
  );
  assert.ok("content" in result);
});

test("content arriving during the brief verification wait wins and cancels the timer", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let releaseContent: ((response: Response) => void) | undefined;
  let releaseLate: ((response: Response) => void) | undefined;
  const updates: string[] = [];
  const request = requestIpfsForViewer(source, (progress) => updates.push(progress.state), (input) => {
    if (input === source) {
      return Promise.resolve(challenge());
    }
    const url = input instanceof Request ? input.url : input.toString();
    if (url.includes("pinata")) {
      return new Promise((resolve) => { releaseContent = resolve; });
    }
    return new Promise((resolve) => { releaseLate = resolve; });
  });
  await new Promise((resolve) => setImmediate(resolve));
  context.mock.timers.tick(100);
  releaseContent!(new Response('{"ready":true}'));
  const result = await request;
  assert.ok("content" in result);
  const finishedUpdates = [...updates];
  context.mock.timers.tick(5000);
  releaseLate!(challenge());
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(updates, finishedUpdates, "cancelled requests must not change the finished viewer");
});

test("a new user-triggered attempt can succeed after verification", async () => {
  let verified = false;
  let calls = 0;
  const fetcher: typeof fetch = () => {
    calls += 1;
    return Promise.resolve(verified ? new Response('{"ready":true}') : challenge());
  };
  assert.deepEqual(await requestIpfsForViewer(source, ignoreProgress, fetcher), {
    verificationRequired: true,
    verificationUrl: source,
  });
  assert.equal(calls, 3);
  verified = true;
  const result = await requestIpfsForViewer(source, ignoreProgress, fetcher);
  assert.ok("content" in result);
  assert.equal(calls, 6);
});

test("ordinary failures reject without selecting a browser check", async () => {
  await assert.rejects(
    requestIpfsForViewer(source, ignoreProgress, () => Promise.reject(new Error("offline"))),
  );
});

test("prefers ipfs.io even when another gateway reports a challenge first", async () => {
  let release: ((response: Response) => void) | undefined;
  const result = requestIpfsForViewer(source, ignoreProgress, (input) => {
    if (input === source) {
      return new Promise((resolve) => { release = resolve; });
    }
    return Promise.resolve(challenge());
  });
  await new Promise((resolve) => setImmediate(resolve));
  release!(challenge());
  assert.deepEqual(await result, { verificationRequired: true, verificationUrl: source });
});

test("selects the challenged gateway when ipfs.io returns an ordinary 403", async () => {
  const gateway = source.replace("ipfs.io", "gateway.ipfs.io");
  const result = await requestIpfsForViewer(source, ignoreProgress, (input) =>
    Promise.resolve(input === gateway ? challenge() : new Response("Forbidden", { status: 403 })),
  );
  assert.deepEqual(result, { verificationRequired: true, verificationUrl: gateway });
});
