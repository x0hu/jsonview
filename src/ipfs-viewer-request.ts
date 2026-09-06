import { fetchIpfsResource, type IpfsGatewayProgress } from "./ipfs-fetch.js";
import { ipfsIoGatewayUrl } from "./ipfs.js";

// Give fast content a brief chance to win without waiting on stalled gateways.
export async function requestIpfsForViewer(
  source: string,
  onProgress: (progress: IpfsGatewayProgress) => void,
  fetcher: typeof fetch = fetch,
  timeoutMs = 5000,
) {
  const challenges = new Set<string>();
  try {
    return await fetchIpfsResource(source, fetcher, timeoutMs, (progress) => {
      if (progress.state === "challenge") {
        challenges.add(progress.url);
      }
      onProgress(progress);
    }, undefined, { challengeGraceMs: 150 });
  } catch (error) {
    if (challenges.size > 0) {
      const preferred = ipfsIoGatewayUrl(source)!;
      const verificationUrl = challenges.has(preferred) ? preferred : [...challenges][0];
      return { verificationRequired: true as const, verificationUrl };
    }
    throw error;
  }
}
