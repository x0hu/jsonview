import { errorPage, jsonToHTML } from "./jsonformatter";

import { installCollapseEventListeners } from "./collapse";
import { decodeJSONDataUrl } from "./data-url.js";
import { isIpfsGatewayUrl } from "./ipfs";
import { parseIpfsJson, type IpfsJsonResult } from "./ipfs-fetch.js";
import { installIpfsLinkListeners } from "./ipfs-links.js";
import { renderDocument } from "./render-document.js";
import { isJSONContentType } from "./content-type.js";
import { safeStringEncodeNums } from "./safe-encode-numbers";

installIpfsLinkListeners();

/**
 * This script runs on every page. It communicates with the background script
 * to help decide whether to treat the contents of the page as JSON.
 */
initializeViewer();

function initializeViewer() {
  // Native media documents need neither JSON detection nor another gateway race.
  if (/^(?:image|audio|video)\//i.test(document.contentType)) {
    return;
  }
  if (isIpfsGatewayUrl(document.URL)) {
    renderIpfsGatewayResponse();
  } else if (
    isJSONContentType(document.contentType) &&
    document.body?.childElementCount === 1 &&
    document.body.firstElementChild?.tagName === "PRE"
  ) {
    // Native JSON documents can render without waking the background worker.
    renderJson(true);
  } else {
    chrome.runtime.sendMessage("jsonview-is-json", (response: boolean) => {
      renderJson(response);
    });
  }
}

function renderJson(response: boolean) {
  const isKnownJsonResponse = response;
  if (!isKnownJsonResponse) {
    return;
  }

  // At least in chrome, the JSON is wrapped in a pre tag.
  const jsonElems = document.getElementsByTagName("pre");
  let content: string | null = null;
  if (jsonElems.length >= 1) {
    content = jsonElems[0].textContent;
  } else {
    // Sometimes there's no pre? I'm not sure why this would happen
    const body = document.body ?? document.documentElement;
    content = (body.firstChild ?? body).textContent;
  }
  let outputDoc = "";
  let jsonObj: any = null;

  if (content === null) {
    outputDoc = errorPage(new Error("No content"), "", document.URL);
  } else {
    let parseContent = content;
    try {
      parseContent = decodeJSONDataUrl(content) ?? content;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      jsonObj = JSON.parse(safeStringEncodeNums(parseContent));
      outputDoc = jsonToHTML(jsonObj, document.URL);
    } catch (e) {
      outputDoc = errorPage(
        e instanceof Error ? e : typeof e === "string" ? new Error(e) : new Error("Unknown error"),
        parseContent,
        document.URL,
      );
    }
  }

  renderDocument(outputDoc);
  installCollapseEventListeners();
}

function renderIpfsGatewayResponse() {
  let rendered = false;
  const observer = new MutationObserver(() => tryEmbeddedJson());
  const timeout = setTimeout(() => observer.disconnect(), 15000);

  function render(content: string) {
    if (rendered) {
      return true;
    }
    try {
      const jsonObj = parseIpfsJson(content);
      rendered = true;
      observer.disconnect();
      clearTimeout(timeout);
      renderDocument(jsonToHTML(jsonObj, document.URL));
      installCollapseEventListeners();
      return true;
    } catch {
      return false;
    }
  }

  function tryEmbeddedJson() {
    for (const element of document.querySelectorAll("pre")) {
      if (element.textContent && render(element.textContent)) {
        return true;
      }
    }
    if (document.contentType !== "text/html") {
      return render(document.body?.textContent ?? "");
    }
    return false;
  }

  if (tryEmbeddedJson()) {
    return;
  }
  // Some gateways insert their JSON after their service worker finishes loading.
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  chrome.runtime.sendMessage("jsonview-ipfs-json", (result: IpfsJsonResult | null) => {
    if (!chrome.runtime.lastError && result) {
      render(result.content);
    }
  });
}
