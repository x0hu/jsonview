import { installCollapseEventListeners } from "./collapse.js";
import { type IpfsGatewayProgress, type IpfsGatewayState } from "./ipfs-fetch.js";
import { requestIpfsForViewer } from "./ipfs-viewer-request.js";
import { installIpfsLinkListeners } from "./ipfs-links.js";
import { ipfsIoGatewayUrl } from "./ipfs.js";
import { jsonToHTML } from "./jsonformatter.js";
import { renderDocument } from "./render-document.js";

function showSourceUrl(source: string) {
  const toolbar = document.createElement("div");
  toolbar.className = "viewer-source";
  const url = document.createElement("input");
  url.type = "text";
  url.readOnly = true;
  url.value = source;
  url.setAttribute("aria-label", "Original URL");
  url.addEventListener("click", () => url.select());
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "Copy URL";
  copy.addEventListener("click", () => {
    void navigator.clipboard
      .writeText(source)
      .then(() => {
        copy.textContent = "Copied";
      })
      .catch(() => {
        url.focus();
        url.select();
        copy.textContent = "Press Ctrl/Cmd+C";
      });
  });
  const original = document.createElement("a");
  original.href = source;
  original.textContent = "Open original";
  original.setAttribute("data-jsonview-original", "");
  toolbar.append(url, copy, original);
  document.body.prepend(toolbar);
}

function showGatewayProgress(onRetry: () => void) {
  for (const previous of document.querySelectorAll(".gateway-progress, .gateway-verification")) {
    previous.remove();
  }
  const status = document.getElementById("ipfs-loading-status")!;
  status.textContent = "Loading IPFS content…";
  const verification = document.createElement("div");
  verification.className = "gateway-verification";
  verification.hidden = true;
  const instructions = document.createElement("p");
  instructions.textContent =
    "Open a browser check below, complete it yourself in the new tab, then return here and retry.";
  const verificationLinks = document.createElement("div");
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "Retry after verification";
  retry.disabled = true;
  retry.addEventListener("click", onRetry);
  verification.append(instructions, verificationLinks, retry);
  document.body.append(verification);
  const challenges = new Set<string>();
  const details = document.createElement("details");
  details.className = "gateway-progress";
  const summary = document.createElement("summary");
  summary.textContent = "Gateway status";
  const list = document.createElement("ul");
  details.append(summary, list);
  document.body.append(details);
  const rows = new Map<string, HTMLLIElement>();
  const labels: Record<IpfsGatewayState, string> = {
    waiting: "Waiting for a response",
    json: "JSON received",
    media: "Media received",
    challenge: "Browser check required",
    "http-error": "Gateway unavailable",
    "not-json": "Returned a webpage instead of JSON",
    "network-error": "Connection failed",
    timeout: "Timed out",
    cancelled: "Cancelled",
  };
  function update(progress: IpfsGatewayProgress) {
    let row = rows.get(progress.url);
    if (!row) {
      row = document.createElement("li");
      rows.set(progress.url, row);
      list.append(row);
    }
    const httpStatus = progress.status === undefined ? "" : ` (HTTP ${progress.status})`;
    row.textContent = `${new URL(progress.url).hostname}: ${labels[progress.state]}${httpStatus}`;
    if (progress.state === "challenge") {
      status.textContent =
        "A gateway requires a browser check. Trying the other gateways while you verify.";
      verification.hidden = false;
      if (!challenges.has(progress.url)) {
        challenges.add(progress.url);
        const link = document.createElement("a");
        link.href = progress.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = `Verify ${new URL(progress.url).hostname}`;
        link.setAttribute("data-jsonview-original", "");
        verificationLinks.append(link);
      }
    } else if (
      ["http-error", "not-json", "network-error"].includes(progress.state) &&
      !status.textContent?.includes("browser check")
    ) {
      status.textContent =
        "Some gateways are unavailable. Trying the others. You can open the original URL now.";
    }
  }
  return {
    update,
    waitForVerification() {
      retry.disabled = false;
      status.textContent =
        "Browser verification is needed. Complete a check in the new tab, then select Retry after verification.";
    },
  };
}

const source = new URL(window.location.href).searchParams.get("url");
if (source && ipfsIoGatewayUrl(source)) {
  const parsed = new URL(source);
  const publicUrl =
    parsed.protocol === "https:" || parsed.protocol === "http:"
      ? source
      : ipfsIoGatewayUrl(source)!;
  showSourceUrl(publicUrl);
  function load() {
    const progress = showGatewayProgress(load);
    void requestIpfsForViewer(source!, progress.update)
      .then((result) => {
        if ("verificationRequired" in result) {
          progress.waitForVerification();
          return;
        }
        if ("media" in result) {
          window.location.replace(result.url);
          return;
        }
        renderDocument(jsonToHTML(result.json, source!));
        showSourceUrl(publicUrl);
        installCollapseEventListeners();
        installIpfsLinkListeners();
      })
      .catch(() => {
        // Ordinary failures still fall back to the original URL.
        window.location.replace(publicUrl);
      });
  }
  load();
} else {
  document.body.textContent = "Invalid IPFS link.";
}
