type IpfsUrlParts = {
  namespace: "ipfs" | "ipns";
  identifier: string;
  path: string;
};

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
      };
    }
  }

  const hostParts = parsed.hostname.toLowerCase().split(".");
  for (const namespace of ["ipfs", "ipns"] as const) {
    const protocolIndex = hostParts.indexOf(namespace);
    if (protocolIndex > 0 && protocolIndex < hostParts.length - 1) {
      return {
        namespace,
        identifier: hostParts.slice(0, protocolIndex).join("."),
        path: parsed.pathname === "/" ? "" : parsed.pathname,
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

  return `https://ipfs.io/${ipfsUrlParts.namespace}/${ipfsUrlParts.identifier}${ipfsUrlParts.path}`;
}

export function ipfsRawGatewayUrls(url: string) {
  const ipfsUrlParts = getIpfsUrlParts(url);
  if (ipfsUrlParts === undefined) {
    return [];
  }

  const path = `${ipfsUrlParts.namespace}/${ipfsUrlParts.identifier}${ipfsUrlParts.path}`;
  return [`https://ipfs.io/${path}`, `https://dweb.link/${path}`];
}
