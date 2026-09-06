import { readCustomGateway } from "./gateway-settings.js";
import { decodeJSONDataUrl } from "./data-url.js";
import { ipfsRawGatewayUrls } from "./ipfs.js";
import { safeStringEncodeNums } from "./safe-encode-numbers.js";

export interface IpfsJsonResult {
  content: string;
  json: unknown;
  url: string;
}

// A redirect to an HTML gateway UI must not win over usable JSON.
export function parseIpfsJson(content: string): unknown {
  return JSON.parse(safeStringEncodeNums(decodeJSONDataUrl(content) ?? content));
}

export interface IpfsMediaResult {
  media: true;
  url: string;
}

export async function fetchIpfsJson(
  url: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 15000,
): Promise<IpfsJsonResult> {
  const result = await fetchIpfsResource(url, fetcher, timeoutMs);
  if ("content" in result) {
    return result;
  }
  throw new Error("IPFS resource is media, not JSON");
}

export type IpfsGatewayState =
  | "waiting"
  | "json"
  | "media"
  | "challenge"
  | "http-error"
  | "not-json"
  | "network-error"
  | "timeout"
  | "cancelled";

export interface IpfsGatewayProgress {
  url: string;
  state: IpfsGatewayState;
  status?: number;
  elapsedMs: number;
}

export async function fetchIpfsResource(
  url: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 15000,
  onProgress?: (progress: IpfsGatewayProgress) => void,
  customGateway?: string,
): Promise<IpfsJsonResult | IpfsMediaResult> {
  const urls = ipfsRawGatewayUrls(url, customGateway ?? await readCustomGateway());
  if (urls.length === 0) {
    throw new Error("Not an IPFS URL");
  }
  const controllers = urls.map(() => new AbortController());
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const started = Date.now();
  const pending = new Set(urls);
  let timedOut = false;
  function report(url: string, state: IpfsGatewayState, status?: number) {
    if (state !== "waiting") {
      pending.delete(url);
    }
    onProgress?.({ url, state, status, elapsedMs: Date.now() - started });
  }
  try {
    return await new Promise<IpfsJsonResult | IpfsMediaResult>((resolve, reject) => {
      let remaining = urls.length;
      timeout = setTimeout(() => {
        timedOut = true;
        reject(new Error("IPFS gateways timed out"));
      }, timeoutMs);
      for (const [index, gatewayUrl] of urls.entries()) {
        report(gatewayUrl, "waiting");
        void (async () => {
          let failure: IpfsGatewayState = "network-error";
          let status: number | undefined;
          try {
            const response = await fetcher(gatewayUrl, {
              // Reuse existing clearance cookies; interactive checks still need a normal tab.
              credentials: "include",
              headers: { Accept: "application/json" },
              signal: controllers[index].signal,
            });
            status = response.status;
            if (response.headers.get("cf-mitigated") === "challenge") {
              failure = "challenge";
              throw new Error("Gateway requires an interactive browser check");
            }
            if (!response.ok) {
              failure = "http-error";
              throw new Error(`HTTP ${response.status}`);
            }
            if (/^(?:image|audio|video)\//i.test(response.headers.get("content-type") ?? "")) {
              report(gatewayUrl, "media", status);
              resolve({ media: true, url: response.url || gatewayUrl });
              return;
            }
            const content = await response.text();
            failure = "not-json";
            const json = parseIpfsJson(content);
            report(gatewayUrl, "json", status);
            resolve({ content, json, url: response.url || gatewayUrl });
          } catch {
            if (controllers[index].signal.aborted) {
              return;
            }
            report(gatewayUrl, failure, status);
            remaining -= 1;
            if (remaining === 0) {
              reject(new Error("No IPFS gateway returned usable content"));
            }
          }
        })();
      }
    });
  } finally {
    clearTimeout(timeout);
    for (const [index, controller] of controllers.entries()) {
      if (pending.has(urls[index])) {
        report(urls[index], timedOut ? "timeout" : "cancelled");
      }
      controller.abort();
    }
  }
}
