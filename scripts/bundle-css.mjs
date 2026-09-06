import { readFile, writeFile } from "node:fs/promises";

// Bundle the stylesheet with the scripts so rendering needs no CSS request.
const css = await readFile(new URL("../src/viewer.css", import.meta.url), "utf8");
await writeFile(
  new URL("../ts-out/viewer-css.js", import.meta.url),
  `export default ${JSON.stringify(css)};\n`,
);
