export const gatewayStorageKey = "customIpfsGateway";

export function normalizeGateway(value: string): string | undefined {
  if (!value.trim()) {
    return undefined;
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a full HTTPS gateway URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("Use HTTPS without a username, password, query, or fragment.");
  }
  if (/\/(?:ipfs|ipns)\/[^/]+/i.test(url.pathname)) {
    throw new Error("Enter the gateway base URL, without a CID or content path.");
  }
  url.pathname = url.pathname.replace(/\/(?:ipfs|ipns)\/?$/i, "").replace(/\/+$/, "");
  return url.href.replace(/\/$/, "");
}

export async function readCustomGateway(): Promise<string | undefined> {
  try {
    if (typeof chrome === "undefined") {
      return undefined;
    }
    const stored = await chrome.storage.local.get(gatewayStorageKey);
    const value: unknown = stored[gatewayStorageKey];
    return typeof value === "string" ? normalizeGateway(value) : undefined;
  } catch {
    // A missing or invalid setting must not prevent public gateway requests.
    return undefined;
  }
}
