import { strict as assert } from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { rollup } from "rollup";

for (const outcome of ["unavailable", "forbidden", "challenge"] as const) {
test(`gateway result ${outcome} only opens verification automatically for an actual challenge`, async () => {
  const bundle = await rollup({ input: fileURLToPath(new URL("./ipfs-viewer.js", import.meta.url)) });
  const { output } = await bundle.generate({ format: "iife" });
  await bundle.close();
  class Element {
    textContent = "";
    href = "";
    target = "";
    disabled = false;
    attributes = new Map<string, string>();
    listeners = new Map<string, () => void>();
    children: Element[] = [];
    append(...children: Element[]) { this.children.push(...children); }
    prepend(...children: Element[]) { this.children.unshift(...children); }
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    addEventListener(name: string, callback: () => void) { this.listeners.set(name, callback); }
  }
  const elements: Element[] = [];
  const status = new Element();
  const navigations: string[] = [];
  const source = "https://eye-order-disease.quicknode-ipfs.com/ipfs/QmThc3Tw1WwU2Y3Lz4omcjmAMvdMbwN8FXcfkA67YD2xtC";
  runInNewContext(output[0].code, {
    URL, AbortController, setTimeout, clearTimeout,
    fetch: () => Promise.resolve(new Response("Unavailable", {
      status: outcome === "unavailable" ? 503 : 403,
      headers: outcome === "challenge" ? { "cf-mitigated": "challenge" } : {},
    })),
    window: { location: {
      href: `https://extension.test/ipfs-viewer.html?url=${encodeURIComponent(source)}`,
      replace: (url: string) => navigations.push(url),
    } },
    document: {
      body: new Element(),
      querySelectorAll: () => [],
      getElementById: () => status,
      createElement: () => { const element = new Element(); elements.push(element); return element; },
    },
  });
  const fallback = elements.find((element) => element.textContent === "Open ipfs.io in this tab");
  assert.ok(fallback, "manual fallback is available before requests complete");
  assert.equal(fallback.href, source.replace("eye-order-disease.quicknode-ipfs.com", "ipfs.io"));
  assert.equal(fallback.target, "_self");
  assert.ok(fallback.attributes.has("data-jsonview-original"));
  assert.deepEqual(navigations, [], "wait for other gateways before starting verification");
  await new Promise((resolve) => setImmediate(resolve));
  if (outcome === "challenge") {
    assert.deepEqual(navigations, [fallback.href], "open one browser check in the current tab");
    assert.match(status.textContent, /opening/i);
  } else {
    assert.deepEqual(navigations, [], "failed requests must not send the user to a stalled gateway");
    assert.match(status.textContent, /could not load/i);
    assert.ok(elements.some((element) => element.textContent === "Retry" && !element.disabled));
  }
});
}
