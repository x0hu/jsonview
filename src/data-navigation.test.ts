import { strict as assert } from "node:assert";
import test from "node:test";
import { dataViewerUrlForTab } from "./data-navigation.js";

const extensionUrl = (path: string) => `chrome-extension://jsonview/${path}`;

test("routes a top-level JSON data URL through the styled data viewer", () => {
  const source = "data:application/json;base64,eyJuYW1lIjoiT3BlbiJ9";

  assert.equal(
    dataViewerUrlForTab(source, extensionUrl),
    `chrome-extension://jsonview/data-viewer.html#${encodeURIComponent(source)}`,
  );
});

test("routes JSON-derived media types and percent-encoded JSON", () => {
  const source = "data:application/ld+json;charset=utf-8,%7B%22name%22%3A%22Open%22%7D";

  assert.equal(
    dataViewerUrlForTab(source, extensionUrl),
    `chrome-extension://jsonview/data-viewer.html#${encodeURIComponent(source)}`,
  );
});

test("does not redirect non-JSON data URLs", () => {
  assert.equal(
    dataViewerUrlForTab("data:application/pdf;base64,JVBERg==", extensionUrl),
    undefined,
  );
});
