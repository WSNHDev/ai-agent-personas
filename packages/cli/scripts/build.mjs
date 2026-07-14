import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: packageDirectory,
    encoding: "utf8",
    windowsHide: true,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(process.execPath, [resolve(packageDirectory, "scripts/clean.mjs")]);
run(process.execPath, [resolve(packageDirectory, "scripts/embed-core.mjs")]);
run(process.execPath, [
  resolve(packageDirectory, "node_modules/typescript/bin/tsc"),
  "-p",
  resolve(packageDirectory, "tsconfig.json"),
]);
run(process.execPath, [resolve(packageDirectory, "scripts/rewrite-core-imports.mjs")]);
run(process.execPath, [resolve(packageDirectory, "scripts/smoke.mjs")]);
