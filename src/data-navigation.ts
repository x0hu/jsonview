import { dataUrlMediaType } from "./data-url.js";

export function dataViewerUrlForTab(url: string, extensionUrl: (path: string) => string) {
  const mediaType = dataUrlMediaType(url);
  if (mediaType !== "application/json" && !mediaType?.endsWith("+json")) {
    return undefined;
  }

  return `${extensionUrl("data-viewer.html")}#${encodeURIComponent(url)}`;
}

export function installDataUrlNavigationListener() {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!changeInfo.url) {
      return;
    }
    const viewerUrl = dataViewerUrlForTab(changeInfo.url, chrome.runtime.getURL);
    if (viewerUrl) {
      void chrome.tabs.update(tabId, { url: viewerUrl });
    }
  });
}
