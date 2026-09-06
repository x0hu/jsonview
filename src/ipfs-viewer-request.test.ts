import { strict as assert } from "node:assert";
import test from "node:test";
import { requestIpfsForViewer } from "./ipfs-viewer-request.js";

const source = "https://ipfs.io/ipfs/QmXf6PSFqDWb7r6RfwU6yoBadUA1LHwkL5HPrspEgWqzaB";
const ignoreProgress = () => {
  /* These tests assert the outcome of the attempt. */
};
const challenge = () =>
  new Response("Browser check", { status: 403, headers: { "cf-mitigated": "challenge" } });

test("keeps the viewer available for verification when another gateway times out", async () => {
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
  assert.deepEqual(result, { verificationRequired: true });
  assert.ok(signals.every((signal) => signal.aborted));
});

test("still uses an available gateway when another one needs verification", async () => {
  let calls = 0;
  const result = await requestIpfsForViewer(source, ignoreProgress, () =>
    Promise.resolve(++calls === 1 ? challenge() : new Response('{"ready":true}')),
  );
  assert.ok("content" in result);
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
  });
  assert.equal(calls, 3);
  verified = true;
  const result = await requestIpfsForViewer(source, ignoreProgress, fetcher);
  assert.ok("content" in result);
  assert.equal(calls, 6);
});

test("ordinary failures still allow the normal navigation fallback", async () => {
  await assert.rejects(
    requestIpfsForViewer(source, ignoreProgress, () => Promise.reject(new Error("offline"))),
  );
});
