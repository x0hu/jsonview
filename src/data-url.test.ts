import { strict as assert } from "node:assert";
import test from "node:test";
import { decodeJSONDataUrl, isJSONDataUrl } from "./data-url.js";

function dataUrlFor(json: string) {
  return `data:application/json;base64,${Buffer.from(json, "utf8").toString("base64")}`;
}

test("decodes a JSON object data URI", () => {
  assert.equal(decodeJSONDataUrl(dataUrlFor('{"ok":true}')), '{"ok":true}');
});

for (const json of ["[1,2,3]", '"hello"', "42"]) {
  test(`decodes a ${json} JSON data URI`, () => {
    assert.equal(decodeJSONDataUrl(dataUrlFor(json)), json);
  });
}

test("tolerates whitespace around a body-level JSON data URI", () => {
  assert.equal(decodeJSONDataUrl(` \n${dataUrlFor('{"ok":true}')}\t`), '{"ok":true}');
});

test("ignores plain JSON", () => {
  assert.equal(decodeJSONDataUrl('{"ok":true}'), null);
});

test("ignores non-JSON data URI media types", () => {
  assert.equal(decodeJSONDataUrl("data:text/plain;base64,eyJvayI6dHJ1ZX0="), null);
});

test("ignores JSON data URI values missing the comma delimiter", () => {
  assert.equal(decodeJSONDataUrl("data:application/json;base64eyJvayI6dHJ1ZX0="), null);
});

test("rejects JSON data URIs with empty payloads", () => {
  assert.throws(() => decodeJSONDataUrl("data:application/json;base64,"), /missing a base64 payload/);
});

test("rejects JSON data URIs with malformed base64", () => {
  assert.throws(() => decodeJSONDataUrl("data:application/json;base64,%%%"), /invalid base64/);
});

test("identifies complete JSON data URI strings", () => {
  assert.ok(isJSONDataUrl(dataUrlFor('{"ok":true}')));
  assert.ok(!isJSONDataUrl(`${dataUrlFor('{"ok":true}')} is great`));
  assert.ok(!isJSONDataUrl(` ${dataUrlFor('{"ok":true}')}`));
});
