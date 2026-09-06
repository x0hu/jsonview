import css from "./viewer-css.js";

let stylesheet: CSSStyleSheet | undefined;

export function renderDocument(html: string) {
  if (!stylesheet) {
    stylesheet = new CSSStyleSheet();
    stylesheet.replaceSync(css);
  }
  // Constructed stylesheets are applied synchronously and survive replacing HTML.
  if (!document.adoptedStyleSheets.includes(stylesheet)) {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
  }
  document.documentElement.innerHTML = html;
}
