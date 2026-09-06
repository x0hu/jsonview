import { normalizeGateway } from "./gateway-settings.js";

interface IpfsUrlParts {
  namespace: "ipfs" | "ipns";
  identifier: string;
  path: string;
  search: string;
}

// DNS subdomain gateways use CIDv1 encoded as base32 or base36.
// Checking the CID structure avoids treating discuss.ipfs.tech as content.
function isSubdomainCid(identifier: string) {
  const base32 = identifier.startsWith("b");
  const alphabet = base32
    ? "abcdefghijklmnopqrstuvwxyz234567"
    : "0123456789abcdefghijklmnopqrstuvwxyz";
  if (!base32 && !identifier.startsWith("k")) {
    return false;
  }
  let value = 0n;
  for (const character of identifier.slice(1)) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) {
      return false;
    }
    value = value * BigInt(alphabet.length) + BigInt(digit);
  }
  if (base32) {
    const padding = ((identifier.length - 1) * 5) % 8;
    if (padding >= 5 || (value & ((1n << BigInt(padding)) - 1n)) !== 0n) {
      return false;
    }
    value >>= BigInt(padding);
  }
  const bytes: number[] = [];
  while (value > 0n) {
    bytes.unshift(Number(value & 255n));
    value >>= 8n;
  }
  let offset = 0;
  function readVarint(): number | undefined {
    let result = 0;
    let multiplier = 1;
    while (offset < bytes.length && multiplier <= 2 ** 49) {
      const byte = bytes[offset++];
      result += (byte & 127) * multiplier;
      if (byte < 128) {
        return result;
      }
      multiplier *= 128;
    }
    return undefined;
  }
  if (readVarint() !== 1) {
    return false;
  }
  const codec = readVarint();
  const hash = readVarint();
  const digestLength = readVarint();
  return (
    codec !== undefined && codec > 0 && hash !== undefined && digestLength === bytes.length - offset
  );
}

function getIpfsUrlParts(url: string): IpfsUrlParts | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }

  if (parsed.protocol === "ipfs:" || parsed.protocol === "ipns:") {
    return {
      namespace: parsed.protocol.slice(0, -1) as IpfsUrlParts["namespace"],
      identifier: parsed.hostname,
      path: parsed.pathname,
      search: parsed.search,
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return undefined;
  }

  if (/^\/(?:ipfs|ipns)\/[^/]+/i.test(parsed.pathname)) {
    const [, namespace, identifier, path = ""] =
      /^\/(ipfs|ipns)\/([^/]+)(\/.*)?$/i.exec(parsed.pathname) ?? [];
    if (namespace !== undefined && identifier !== undefined) {
      return {
        namespace: namespace.toLowerCase() as IpfsUrlParts["namespace"],
        identifier,
        path,
        search: parsed.search,
      };
    }
  }

  const hostParts = parsed.hostname.toLowerCase().split(".");
  for (const namespace of ["ipfs", "ipns"] as const) {
    const protocolIndex = hostParts.indexOf(namespace);
    if (protocolIndex > 0 && protocolIndex < hostParts.length - 1) {
      const identifier = hostParts.slice(0, protocolIndex).join(".");
      if (namespace === "ipfs" && !isSubdomainCid(identifier)) {
        continue;
      }
      return {
        namespace,
        identifier,
        path: parsed.pathname === "/" ? "" : parsed.pathname,
        search: parsed.search,
      };
    }
  }

  return undefined;
}

export function isIpfsGatewayUrl(url: string) {
  return getIpfsUrlParts(url) !== undefined;
}

export function ipfsIoGatewayUrl(url: string) {
  const ipfsUrlParts = getIpfsUrlParts(url);
  if (ipfsUrlParts === undefined) {
    return undefined;
  }

  return `https://ipfs.io/${ipfsUrlParts.namespace}/${ipfsUrlParts.identifier}${ipfsUrlParts.path}${ipfsUrlParts.search}`;
}

export function ipfsRawGatewayUrls(url: string, customGateway?: string) {
  const ipfsUrlParts = getIpfsUrlParts(url);
  if (ipfsUrlParts === undefined) {
    return [];
  }

  const path = `${ipfsUrlParts.namespace}/${ipfsUrlParts.identifier}${ipfsUrlParts.path}${ipfsUrlParts.search}`;
  const urls = [
    `https://ipfs.io/${path}`,
    `https://gateway.pinata.cloud/${path}`,
    `https://gateway.ipfs.io/${path}`,
  ];
  if (customGateway) {
    try {
      const gateway = normalizeGateway(customGateway);
      if (gateway) {
        urls.push(`${gateway}/${path}`);
      }
    } catch {
      // Invalid stored settings must leave the public gateways available.
    }
  }
  return [...new Set(urls)];
}
