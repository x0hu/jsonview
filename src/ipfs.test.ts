import { strict as assert } from "node:assert";
import test from "node:test";
import { ipfsIoGatewayUrl, ipfsRawGatewayUrls, isIpfsGatewayUrl } from "./ipfs.js";

const ipfsGatewayUrls = [
  "ipfs://bafkreieuew6at7kgjdrv5uvsr3m6uogfx6dip2qbl5rzio7fzi5l4o6pim",
  "ipns://example.com/metadata.json",
  "https://ipfs.io/ipfs/bafkreieuew6at7kgjdrv5uvsr3m6uogfx6dip2qbl5rzio7fzi5l4o6pim",
  "https://gateway.pinata.cloud/ipfs/bafkreieuew6at7kgjdrv5uvsr3m6uogfx6dip2qbl5rzio7fzi5l4o6pim",
  "http://127.0.0.1:8080/ipfs/bafkreieuew6at7kgjdrv5uvsr3m6uogfx6dip2qbl5rzio7fzi5l4o6pim",
  "https://bafkreieuew6at7kgjdrv5uvsr3m6uogfx6dip2qbl5rzio7fzi5l4o6pim.ipfs.dweb.link",
  "https://bafkreiguejqtyoal6j5rgmjvr6kljpmajed2wkxgpukhwzf5qkmilmraze.ipfs.inbrowser.link/",
  "https://example.com.ipns.dweb.link/metadata.json",
];

const ipfsGatewayConversions = [
  [
    "https://bafkreiguejqtyoal6j5rgmjvr6kljpmajed2wkxgpukhwzf5qkmilmraze.ipfs.inbrowser.link/",
    "https://ipfs.io/ipfs/bafkreiguejqtyoal6j5rgmjvr6kljpmajed2wkxgpukhwzf5qkmilmraze",
  ],
  [
    "https://gateway.pinata.cloud/ipfs/bafkreieuew6at7kgjdrv5uvsr3m6uogfx6dip2qbl5rzio7fzi5l4o6pim/metadata.json",
    "https://ipfs.io/ipfs/bafkreieuew6at7kgjdrv5uvsr3m6uogfx6dip2qbl5rzio7fzi5l4o6pim/metadata.json",
  ],
  [
    "https://example.com.ipns.dweb.link/metadata.json",
    "https://ipfs.io/ipns/example.com/metadata.json",
  ],
];

const nonIpfsGatewayUrls = [
  "https://discuss.ipfs.tech/t/curated-list-of-ipfs-gateways/620?page=2",
  "https://gateway.ipfs.io/",
  "https://docs.ipfs.tech/",
  "https://blog.ipfs.example.com/article",

  "https://api.bankr.bot/token-launches/0x0BB65e58E178C82B9148072632DE329655fa0Ba3",
  "https://example.com/ipfs",
  "https://example.com/not-ipfs/bafkreieuew6at7kgjdrv5uvsr3m6uogfx6dip2qbl5rzio7fzi5l4o6pim",
  "mailto:ipfs@example.com",
  "not a url",
];

for (const url of ipfsGatewayUrls) {
  test(`correctly identifies ${url} as an IPFS gateway URL`, () => {
    assert.ok(isIpfsGatewayUrl(url));
  });
}

for (const url of nonIpfsGatewayUrls) {
  test(`correctly identifies ${url} as NOT an IPFS gateway URL`, () => {
    assert.ok(!isIpfsGatewayUrl(url));
  });
}

for (const [url, gatewayUrl] of ipfsGatewayConversions) {
  test(`converts ${url} to ${gatewayUrl}`, () => {
    assert.equal(ipfsIoGatewayUrl(url), gatewayUrl);
  });
}

test("returns raw gateway candidates for IPFS content", () => {
  assert.deepEqual(
    ipfsRawGatewayUrls(
      "https://bafkreiguejqtyoal6j5rgmjvr6kljpmajed2wkxgpukhwzf5qkmilmraze.ipfs.inbrowser.link/",
    ),
    [
      "https://ipfs.io/ipfs/bafkreiguejqtyoal6j5rgmjvr6kljpmajed2wkxgpukhwzf5qkmilmraze",
      "https://gateway.pinata.cloud/ipfs/bafkreiguejqtyoal6j5rgmjvr6kljpmajed2wkxgpukhwzf5qkmilmraze",
      "https://gateway.ipfs.io/ipfs/bafkreiguejqtyoal6j5rgmjvr6kljpmajed2wkxgpukhwzf5qkmilmraze",
      "https://bafkreiguejqtyoal6j5rgmjvr6kljpmajed2wkxgpukhwzf5qkmilmraze.ipfs.inbrowser.link/",
    ],
  );
});

test("races the same CID and path on all three hosts, retaining query parameters", () => {
  const path =
    "/ipfs/QmWaZ7imFJPcYDLPUykLycbtG2DhmYckqXMosFVWx9DUsN/folder/meta.json?filename=meta.json";
  assert.deepEqual(
    ipfsRawGatewayUrls(`https://gateway.pinata.cloud${path}#fragment`),
    [
      `https://ipfs.io${path}`,
      `https://gateway.pinata.cloud${path}`,
      `https://gateway.ipfs.io${path}`,
    ],
  );
});

test("recognizes base36 CIDv1 subdomains and rejects malformed CIDs", () => {
  const digest = "00".repeat(32);
  const cid = `k${BigInt(`0x01551220${digest}`).toString(36)}`;
  assert.ok(isIpfsGatewayUrl(`https://${cid}.ipfs.dweb.link/metadata.json`));
  for (const bytes of ["02551220" + digest, "01551220", "0180"]) {
    const invalidCid = `k${BigInt(`0x${bytes}`).toString(36)}`;
    assert.equal(isIpfsGatewayUrl(`https://${invalidCid}.ipfs.dweb.link/`), false);
  }
});

test("does not generate requests for the IPFS forum or gateway homepage", () => {
  for (const url of [
    "https://discuss.ipfs.tech/t/curated-list-of-ipfs-gateways/620?page=2",
    "https://gateway.ipfs.io/",
  ]) {
    assert.equal(ipfsIoGatewayUrl(url), undefined);
    assert.deepEqual(ipfsRawGatewayUrls(url), []);
  }
});
