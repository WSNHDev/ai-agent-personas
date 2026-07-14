#!/usr/bin/env node
import { validatePersonaPath } from "../loader.js";

try {
  const report = validatePersonaPath(process.argv[2]);
  if (!report.valid) {
    for (const failure of report.failures) {
      console.error(failure.message);
    }
    process.exitCode = 1;
  } else {
    console.log(`Validated ${report.checked} persona manifest${report.checked === 1 ? "" : "s"}.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
