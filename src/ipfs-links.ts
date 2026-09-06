import { isIpfsGatewayUrl } from "./ipfs.js";

// Keep native navigation behavior, including Cmd/Ctrl-click and middle-click.
export function installIpfsLinkListeners() {
  function routeLink(event: MouseEvent) {
    if (event.defaultPrevented || event.button > 1 || event.altKey) {
      return;
    }
    const anchor = event.composedPath().find((element) => element instanceof HTMLAnchorElement);
    if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download")) {
      return;
    }
    if (!isIpfsGatewayUrl(anchor.href)) {
      return;
    }
    const original = anchor.getAttribute("href")!;
    const viewerUrl = `${chrome.runtime.getURL("ipfs-viewer.html")}?url=${encodeURIComponent(anchor.href)}`;
    anchor.href = viewerUrl;
    setTimeout(() => {
      if (anchor.href === viewerUrl) {
        anchor.setAttribute("href", original);
      }
    }, 0);
  }
  document.addEventListener("click", routeLink);
  document.addEventListener("auxclick", routeLink);
}
