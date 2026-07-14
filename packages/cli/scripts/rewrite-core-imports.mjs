import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = resolve(packageDirectory, "dist");
const coreEntry = resolve(distDirectory, "core/index.js");
const workspaceSpecifier = "@ai-agent-personas/core";

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (path !== resolve(distDirectory, "core")) {
        files.push(...(await filesIn(path)));
      }
    } else if (/\.(?:js|d\.ts|map)$/u.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

for (const file of await filesIn(distDirectory)) {
  const source = await readFile(file, "utf8");
  if (!source.includes(workspaceSpecifier)) continue;
  let target = relative(dirname(file), coreEntry).split(sep).join("/");
  if (!target.startsWith(".")) target = `./${target}`;
  await writeFile(file, source.replaceAll(workspaceSpecifier, target), "utf8");
}

for (const file of await filesIn(distDirectory)) {
  if ((await readFile(file, "utf8")).includes(workspaceSpecifier)) {
    throw new Error(`Workspace core import remains in ${file}`);
  }
}

const packageJson = JSON.parse(
  await readFile(resolve(packageDirectory, "package.json"), "utf8"),
);
for (const field of [
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
  "bundleDependencies",
  "bundledDependencies",
]) {
  if (JSON.stringify(packageJson[field] ?? {}).includes(workspaceSpecifier)) {
    throw new Error(`Published package.json has a runtime core reference in ${field}.`);
  }
}
