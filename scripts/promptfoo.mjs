import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = fileURLToPath(new URL('../', import.meta.url));
const promptfooIndex = fileURLToPath(import.meta.resolve('promptfoo'));
const promptfooEntrypoint = join(dirname(promptfooIndex), 'entrypoint.js');

const child = spawn(process.execPath, [promptfooEntrypoint, ...process.argv.slice(2)], {
  cwd: workspaceRoot,
  env: {
    ...process.env,
    PROMPTFOO_CONFIG_DIR: join(workspaceRoot, '.promptfoo'),
    PROMPTFOO_DISABLE_TELEMETRY: 'true',
    PROMPTFOO_DISABLE_UPDATE: 'true',
  },
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`Unable to start Promptfoo: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
