import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const script = fileURLToPath(new URL("verify-release.mjs", import.meta.url));

function verify(tag) {
  return spawnSync(process.execPath, [script, tag], {
    cwd: root,
    encoding: "utf8",
  });
}

test("release verification rejects malformed semantic versions", () => {
  for (const tag of ["v1.0.0-..", "v1.0.0-01", "v1.0.0-alpha..1"]) {
    const result = verify(tag);
    assert.equal(result.status, 1, tag);
    assert.match(result.stderr, /not a valid v-prefixed semantic version/u, tag);
  }
});

test("release verification accepts strict prerelease syntax before checking package parity", () => {
  const result = verify("v1.0.0-alpha.1+build.5");
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stderr, /not a valid v-prefixed semantic version/u);
  assert.match(result.stderr, /does not match v0\.1\.0/u);
});

test("release verification accepts the current package tag", () => {
  const result = verify("v0.1.0");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /consistent for v0\.1\.0/u);
});
