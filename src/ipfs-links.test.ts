import { strict as assert } from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { rollup } from "rollup";

const source =
  "https://gateway.pinata.cloud/ipfs/bafkreiab356xoxeszx74i5tnlyojeox76udha26outd5qashrxevhdgwga";

for (const invalidation of ["missing-id", "throws"] as const) {
  test(`stale IPFS handlers leave native navigation intact when runtime ${invalidation}`, async () => {
    const bundle = await rollup({
      input: fileURLToPath(new URL("./ipfs-links.js", import.meta.url)),
    });
    const { output } = await bundle.generate({ format: "iife", name: "IpfsLinks" });
    await bundle.close();
    const listeners = new Map<string, (event: unknown) => void>();
    class Anchor {
      href = source;
      attributes = new Set<string>();
      hasAttribute(name: string) {
        return this.attributes.has(name);
      }
      getAttribute() {
        return this.href;
      }
      setAttribute(_name: string, value: string) {
        this.href = value;
      }
    }
    const anchor = new Anchor();
    runInNewContext(`${output[0].code}\nIpfsLinks.installIpfsLinkListeners();`, {
      URL,
      HTMLAnchorElement: Anchor,
      document: {
        addEventListener: (name: string, callback: (event: unknown) => void) =>
          listeners.set(name, callback),
        removeEventListener: (name: string) => listeners.delete(name),
      },
      chrome: {
        runtime: {
          id: invalidation === "missing-id" ? undefined : "jsonview",
          getURL: () => {
            throw new Error("Extension context invalidated.");
          },
        },
      },
    });
    const click = listeners.get("click")!;
    assert.doesNotThrow(() => click({ button: 0, composedPath: () => [anchor] }));
    assert.equal(anchor.href, source);
    assert.equal(listeners.size, 0);
  });
}
