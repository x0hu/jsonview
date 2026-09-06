import { fetchIpfsResource, type IpfsGatewayProgress } from "./ipfs-fetch.js";

// A challenge must leave the viewer available while the user verifies in a tab.
export async function requestIpfsForViewer(
  source: string,
  onProgress: (progress: IpfsGatewayProgress) => void,
  fetcher: typeof fetch = fetch,
  timeoutMs = 5000,
) {
  let needsVerification = false;
  try {
    return await fetchIpfsResource(source, fetcher, timeoutMs, (progress) => {
      if (progress.state === "challenge") {
        needsVerification = true;
      }
      onProgress(progress);
    });
  } catch (error) {
    if (needsVerification) {
      return { verificationRequired: true as const };
    }
    throw error;
  }
}
