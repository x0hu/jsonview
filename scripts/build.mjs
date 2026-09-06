import { spawnSync } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";
import { rollup } from "rollup";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const compiled = join(root, "ts-out");

function runNode(args) {
  // Invoke Node directly: Windows cannot execute Unix shell scripts or expand globs.
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function bundle(input, output) {
  const build = await rollup({ input });
  try {
    await build.write({ file: output, format: "es" });
  } finally {
    await build.close();
  }
}

async function archiveFiles(directory, prefix = "") {
  const files = {};
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    // ZIP member names always use forward slashes, including on Windows.
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      Object.assign(files, await archiveFiles(path, `${name}/`));
    } else {
      files[name] = await readFile(path);
    }
  }
  return files;
}

await rm(compiled, { recursive: true, force: true });
runNode([require.resolve("typescript/bin/tsc")]);
await import("./bundle-css.mjs");
const tests = (await readdir(compiled))
  .filter((name) => name.endsWith(".test.js"))
  .sort()
  .map((name) => join(compiled, name));
if (tests.length === 0) throw new Error("No compiled tests found");
runNode(["--test", ...tests]);

const icons = (await readdir(join(root, "src"))).filter((name) => /^icon.*\.png$/.test(name));
for (const browser of ["chrome", "firefox"]) {
  const output = join(root, `build-${browser}`);
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await bundle(join(compiled, `background-${browser}.js`), join(output, "background.js"));
  await bundle(join(compiled, "content.js"), join(output, "content.js"));
  await bundle(join(compiled, "ipfs-viewer.js"), join(output, "ipfs-viewer.js"));
  await bundle(join(compiled, "popup.js"), join(output, "popup.js"));
  for (const asset of ["ipfs-viewer.html", "viewer.css", "popup.html", "popup.css", ...icons]) {
    await cp(join(root, "src", asset), join(output, asset));
  }
  await cp(join(root, "src", `manifest.${browser}.json`), join(output, "manifest.json"));
  await cp(join(root, "license.txt"), join(output, "license.txt"));
  await cp(join(root, "src", "_locales"), join(output, "_locales"), { recursive: true });
  await writeFile(join(root, `jsonview-${browser}.zip`), zipSync(await archiveFiles(output)));
  console.log(`Built ${output} and jsonview-${browser}.zip`);
}
