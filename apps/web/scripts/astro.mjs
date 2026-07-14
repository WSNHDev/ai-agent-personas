import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const astroBinary = resolve(packageDirectory, "node_modules/astro/bin/astro.mjs");
const result = spawnSync(process.execPath, [astroBinary, ...process.argv.slice(2)], {
  cwd: packageDirectory,
  env: {
    ...process.env,
    ASTRO_TELEMETRY_DISABLED: "1",
  },
  stdio: "inherit",
  windowsHide: true,
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
