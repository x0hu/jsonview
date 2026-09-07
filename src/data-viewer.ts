import { dataUrlMediaType } from "./data-url.js";
import { jsonToHTML } from "./jsonformatter.js";
import { renderDocument } from "./render-document.js";
import { safeStringEncodeNums } from "./safe-encode-numbers.js";
import { installCollapseEventListeners } from "./collapse.js";
import { installIpfsLinkListeners } from "./ipfs-links.js";

async function showData() {
  const source = decodeURIComponent(window.location.hash.slice(1));
  const mediaType = dataUrlMediaType(source);
  if (!mediaType) {
    throw new Error("Invalid image or application data URL.");
  }
  document.body.replaceChildren();
  if (mediaType.startsWith("image/")) {
    document.body.classList.add("data-image-viewer");
    const preview = document.createElement("div");
    preview.className = "data-image-preview";
    // SVG stays in an image context so embedded scripts cannot run.
    const image = document.createElement("img");
    image.alt = "Embedded image";
    image.src = source;
    image.addEventListener("error", () => {
      image.replaceWith(document.createTextNode("Unable to preview this image."));
    });
    preview.append(image);
    document.body.append(preview);
  } else if (mediaType === "application/json" || mediaType.endsWith("+json")) {
    const content = await (await fetch(source)).text();
    renderDocument(jsonToHTML(JSON.parse(safeStringEncodeNums(content)), "Embedded JSON"));
    installCollapseEventListeners();
    installIpfsLinkListeners();
  } else {
    const description = document.createElement("p");
    description.textContent = `Embedded ${mediaType} file. Download to open it.`;
    document.body.append(description);
  }
  const download = document.createElement("a");
  download.href = source;
  download.download = `embedded.${mediaType.split("/")[1].split("+")[0]}`;
  download.textContent = "Download embedded file";
  const toolbar = document.createElement("div");
  toolbar.className = "viewer-source";
  toolbar.append(download);
  document.body.prepend(toolbar);
}

// Links inside embedded JSON can point to another payload on this same page.
window.addEventListener("hashchange", () => window.location.reload());

void showData().catch((error: unknown) => {
  document.body.textContent = error instanceof Error ? error.message : "Unable to open embedded data.";
});
