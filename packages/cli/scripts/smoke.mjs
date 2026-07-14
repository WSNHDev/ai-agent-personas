import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageMetadata = JSON.parse(
  await readFile(resolve(packageDirectory, "package.json"), "utf8"),
);
const result = spawnSync(process.execPath, [resolve(packageDirectory, "dist/bin.js"), "--version"], {
  encoding: "utf8",
  windowsHide: true,
});

if (result.status !== 0 || result.stdout.trim() !== packageMetadata.version) {
  process.stderr.write(result.stderr || "CLI smoke test failed.\n");
  process.exitCode = 1;
}
