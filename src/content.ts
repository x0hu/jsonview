import { errorPage, jsonToHTML } from "./jsonformatter";

import { installCollapseEventListeners } from "./collapse";
import { ipfsRawGatewayUrls, isIpfsGatewayUrl } from "./ipfs";
import { safeStringEncodeNums } from "./safe-encode-numbers";

/**
 * This script runs on every page. It communicates with the background script
 * to help decide whether to treat the contents of the page as JSON.
 */
chrome.runtime.sendMessage("jsonview-is-json", (response: boolean) => {
  void renderJson(response);
});

async function renderJson(response: boolean) {
  const isKnownJsonResponse = response === true;
  const shouldTryJsonResponse = !isKnownJsonResponse && isIpfsGatewayUrl(document.URL);

  if (shouldTryJsonResponse) {
    await renderIpfsGatewayResponse();
    return;
  }

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
    content = (document.body.firstChild ?? document.body).textContent;
  }
  let outputDoc = "";
  let jsonObj: any = null;

  if (content === null) {
    outputDoc = errorPage(new Error("No content"), "", document.URL);
  } else {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      jsonObj = JSON.parse(safeStringEncodeNums(content));
      outputDoc = jsonToHTML(jsonObj, document.URL);
    } catch (e) {
      outputDoc = errorPage(
        e instanceof Error ? e : typeof e === "string" ? new Error(e) : new Error("Unknown error"),
        content,
        document.URL,
      );
    }
  }

  document.documentElement.innerHTML = outputDoc;
  installCollapseEventListeners();
}

async function renderIpfsGatewayResponse() {
  for (const gatewayUrl of ipfsRawGatewayUrls(document.URL)) {
    let content: string;
    try {
      const response = await fetch(gatewayUrl, { credentials: "omit" });
      content = await response.text();
    } catch {
      continue;
    }

    try {
      const jsonObj: unknown = JSON.parse(safeStringEncodeNums(content));
      document.documentElement.innerHTML = jsonToHTML(jsonObj, document.URL);
      installCollapseEventListeners();
      return;
    } catch {
      continue;
    }
  }
}
