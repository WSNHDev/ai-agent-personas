import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const coreDirectory = resolve(packageDirectory, "../core");
const targetDirectory = resolve(packageDirectory, "dist/core");
const schemaDirectory = resolve(packageDirectory, "dist/schema");

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

await rm(targetDirectory, { recursive: true, force: true });
await rm(schemaDirectory, { recursive: true, force: true });
await mkdir(targetDirectory, { recursive: true });
await mkdir(schemaDirectory, { recursive: true });
await cp(
  resolve(coreDirectory, "schema/persona.schema.json"),
  resolve(schemaDirectory, "persona.schema.json"),
);

const tsc = resolve(coreDirectory, "node_modules/typescript/bin/tsc");
run(
  process.execPath,
  [
    tsc,
    "-p",
    resolve(coreDirectory, "tsconfig.json"),
    "--outDir",
    targetDirectory,
    "--rootDir",
    resolve(coreDirectory, "src"),
    "--tsBuildInfoFile",
    resolve(targetDirectory, ".tsbuildinfo"),
  ],
  coreDirectory,
);
run(
  process.execPath,
  [resolve(coreDirectory, "scripts/build-assets.mjs"), targetDirectory],
  coreDirectory,
);
