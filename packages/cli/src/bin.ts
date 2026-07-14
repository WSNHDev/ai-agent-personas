#!/usr/bin/env node
import { runCli } from "./cli.js";

process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EPIPE") {
    process.exit(0);
  }
  throw error;
});

process.exitCode = runCli(process.argv.slice(2));
