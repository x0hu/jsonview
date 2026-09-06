import { installCollapseEventListeners } from "./collapse.js";
import { fetchIpfsResource } from "./ipfs-fetch.js";
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
  toolbar.append(url, copy);
  document.body.prepend(toolbar);
}

const source = new URL(window.location.href).searchParams.get("url");
if (source && ipfsIoGatewayUrl(source)) {
  const parsed = new URL(source);
  const publicUrl =
    parsed.protocol === "https:" || parsed.protocol === "http:"
      ? source
      : ipfsIoGatewayUrl(source)!;
  showSourceUrl(publicUrl);
  void fetchIpfsResource(source)
    .then((result) => {
      if ("media" in result) {
        window.location.replace(result.url);
        return;
      }
      renderDocument(jsonToHTML(result.json, source));
      showSourceUrl(publicUrl);
      installCollapseEventListeners();
      installIpfsLinkListeners();
    })
    .catch(() => {
      // Websites and unavailable content keep their ordinary browser behavior.
      window.location.replace(publicUrl);
    });
} else {
  document.body.textContent = "Invalid IPFS link.";
}
