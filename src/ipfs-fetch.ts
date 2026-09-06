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

export async function fetchIpfsResource(
  url: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 15000,
): Promise<IpfsJsonResult | IpfsMediaResult> {
  const urls = ipfsRawGatewayUrls(url);
  if (urls.length === 0) {
    throw new Error("Not an IPFS URL");
  }
  const controllers = urls.map(() => new AbortController());
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<IpfsJsonResult | IpfsMediaResult>((resolve, reject) => {
      let remaining = urls.length;
      timeout = setTimeout(() => reject(new Error("IPFS gateways timed out")), timeoutMs);
      for (const [index, gatewayUrl] of urls.entries()) {
        void (async () => {
          try {
            const response = await fetcher(gatewayUrl, {
              credentials: "omit",
              headers: { Accept: "application/json" },
              signal: controllers[index].signal,
            });
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            if (/^(?:image|audio|video)\//i.test(response.headers.get("content-type") ?? "")) {
              resolve({ media: true, url: response.url || gatewayUrl });
              return;
            }
            const content = await response.text();
            const json = parseIpfsJson(content);
            resolve({ content, json, url: response.url || gatewayUrl });
          } catch {
            remaining -= 1;
            if (remaining === 0) {
              reject(new Error("No IPFS gateway returned JSON"));
            }
          }
        })();
      }
    });
  } finally {
    clearTimeout(timeout);
    for (const controller of controllers) {
      controller.abort();
    }
  }
}
