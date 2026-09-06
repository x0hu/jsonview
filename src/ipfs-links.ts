import { isIpfsGatewayUrl } from "./ipfs.js";

// Keep native navigation behavior, including Cmd/Ctrl-click and middle-click.
export function installIpfsLinkListeners() {
  function routeLink(event: MouseEvent) {
    if (event.defaultPrevented || event.button > 1 || event.altKey) {
      return;
    }
    const anchor = event.composedPath().find((element) => element instanceof HTMLAnchorElement);
    if (
      !(anchor instanceof HTMLAnchorElement) ||
      anchor.hasAttribute("download") ||
      anchor.hasAttribute("data-jsonview-original")
    ) {
      return;
    }
    if (!isIpfsGatewayUrl(anchor.href)) {
      return;
    }
    let viewerPage: string | undefined;
    try {
      // Reloading the extension invalidates content scripts in existing tabs.
      if (chrome.runtime?.id) {
        viewerPage = chrome.runtime.getURL("ipfs-viewer.html");
      }
    } catch {
      // A reload can also race with the runtime call after the id check.
    }
    if (!viewerPage) {
      document.removeEventListener("click", routeLink);
      document.removeEventListener("auxclick", routeLink);
      return; // Leave the original href and native click behavior untouched.
    }
    const original = anchor.getAttribute("href")!;
    const viewerUrl = `${viewerPage}?url=${encodeURIComponent(anchor.href)}`;
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
