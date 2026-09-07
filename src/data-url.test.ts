import { strict as assert } from "node:assert";
import test from "node:test";
import { dataUrlMediaType, decodeJSONDataUrl, isJSONDataUrl } from "./data-url.js";

test("recognizes embedded image and application files", () => {
  for (const [value, type] of [
    ["data:image/svg+xml;base64,PHN2Zy8+", "image/svg+xml"],
    ["data:image/svg+xml,%3Csvg%2F%3E", "image/svg+xml"],
    ["DATA:IMAGE/PNG;BASE64,aGVsbG8=", "image/png"],
    ["data:application/json;charset=utf-8,%7B%22ok%22%3Atrue%7D", "application/json"],
    ["data:application/ld+json;base64,e30=", "application/ld+json"],
    ["data:application/pdf;base64,JVBERg==", "application/pdf"],
  ]) {
    assert.equal(dataUrlMediaType(value), type);
  }
});

test("leaves malformed and unsupported data URLs as strings", () => {
  for (const value of [
    "data:text/html,%3Cscript%3E", "javascript:alert(1)",
    "data:image/png;base64,%%%", "data:image/png;base64,a",
    "data:image/png;base64,", "data:image/svg+xml,%ZZ",
    "data:image/png;base64,aGVsbG8= trailing text", " data:image/png;base64,aGVsbG8=",
    "data:image/png;base64aGVsbG8=",
  ]) {
    assert.equal(dataUrlMediaType(value), undefined, value);
  }
});

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
