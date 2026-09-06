import { strict as assert } from "node:assert";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { rollup } from "rollup";

const wrapperUrl =
  "https://bafkreiguejqtyoal6j5rgmjvr6kljpmajed2wkxgpukhwzf5qkmilmraze.ipfs.inbrowser.link/";

for (const delayed of [false, true]) {
  test(`formats gateway wrapper JSON ${delayed ? "inserted later" : "already present"}`, async () => {
    const bundle = await rollup({ input: fileURLToPath(new URL("./content.js", import.meta.url)) });
    const { output } = await bundle.generate({ format: "iife" });
    await bundle.close();
    const messages: string[] = [];
    const sheets: { css: string }[] = [];
    let adoptedSheets: { css: string }[] = [];
    const pre = { textContent: '{"name":"civocloud","attributes":[{"chain":"base"}]}' };
    let elements = delayed ? [] : [pre];
    let onMutation = () => {
      /* Replaced when the observer is created. */
    };
    let html = "<header>ipfs application/json</header><pre>JSON</pre>";
    const root = {
      get innerHTML() {
        return html;
      },
      set innerHTML(value: string) {
        assert.ok(
          adoptedSheets.some((sheet) => sheet.css.includes(".prop")),
          "Styles must be applied before the formatted JSON is exposed",
        );
        html = value;
      },
    };
    const timers = new Set<() => void>();
    runInNewContext(output[0].code, {
      URL,
      document: {
        URL: wrapperUrl,
        get adoptedStyleSheets() {
          return adoptedSheets;
        },
        set adoptedStyleSheets(value: { css: string }[]) {
          adoptedSheets = value;
        },
        contentType: "text/html",
        documentElement: root,
        querySelectorAll: () => elements,
        addEventListener: () => {
          /* No interaction needed for this rendering test. */
        },
      },
      chrome: {
        runtime: {
          getURL: (path: string) => `chrome-extension://jsonview/${path}`,
          sendMessage: (message: string, callback: (response: boolean | null) => void) => {
            messages.push(message);
            if (message !== "jsonview-is-json") {
              callback(null);
            }
          },
        },
      },
      CSSStyleSheet: class {
        css = "";
        constructor() {
          sheets.push(this);
        }
        replaceSync(css: string) {
          this.css = css;
        }
      },
      MutationObserver: class {
        active = false;
        constructor(callback: () => void) {
          onMutation = () => {
            if (this.active) {
              callback();
            }
          };
        }
        observe() {
          this.active = true;
        }
        disconnect() {
          this.active = false;
        }
      },
      setTimeout: (callback: () => void) => {
        timers.add(callback);
        return callback;
      },
      clearTimeout: (callback: () => void) => timers.delete(callback),
    });
    if (delayed) {
      elements = [pre];
      onMutation();
    }
    assert.match(root.innerHTML, /id="json"/);
    assert.match(root.innerHTML, /civocloud/);
    assert.ok(sheets[0].css.includes(".prop"));
    assert.ok(!messages.includes("jsonview-is-json"));
    assert.ok(!messages.includes("jsonview-style"));
    assert.equal(timers.size, 0);
    if (!delayed) {
      assert.ok(!messages.includes("jsonview-ipfs-json"));
    }
  });
}

test("leaves IPFS image documents alone without fetching them again", async () => {
  const bundle = await rollup({ input: fileURLToPath(new URL("./content.js", import.meta.url)) });
  const { output } = await bundle.generate({ format: "iife" });
  await bundle.close();
  for (const contentType of ["image/png", "image/svg+xml", "audio/mpeg", "video/mp4"]) {
    runInNewContext(output[0].code, {
      URL,
      document: {
        URL: wrapperUrl,
        contentType,
        body: null,
        addEventListener: () => {
          /* No interaction needed. */
        },
      },
      chrome: {
        runtime: {
          sendMessage: () => assert.fail("Media must not start JSON detection or fetching"),
        },
      },
    });
  }
});
