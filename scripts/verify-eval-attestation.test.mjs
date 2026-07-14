import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { createEvalAttestation } from "./eval-attestation.mjs";
import {
  EvalAttestationVerificationError,
  verifyEvalAttestation,
} from "./verify-eval-attestation.mjs";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const REPOSITORY = "owner/ai-agent-personas";
const RUN_ID = "123456789";
const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createFixture() {
  const directory = await mkdtemp(join(tmpdir(), "eval-attestation-"));
  temporaryDirectories.push(directory);
  const configPath = join(directory, "promptfooconfig.yaml");
  const resultsPath = join(directory, "eval-results.json");
  const attestationPath = join(directory, "eval-attestation.json");
  await writeFile(configPath, "description: deterministic fixture\n", "utf8");
  await writeFile(resultsPath, '{"results":[{"success":true}]}\n', "utf8");

  const attestation = await createEvalAttestation({
    commit: COMMIT,
    ref: "refs/heads/main",
    repository: REPOSITORY,
    provider: "openai:responses:test-model",
    outcome: "success",
    configPath,
    resultsPath: "eval-results.json",
    resultsFilePath: resultsPath,
    workflowRunId: RUN_ID,
    workflowRunAttempt: "1",
    generatedAt: "2026-07-15T00:00:00.000Z",
  });
  await writeFile(attestationPath, `${JSON.stringify(attestation, null, 2)}\n`, "utf8");

  return { directory, configPath, resultsPath, attestationPath, attestation };
}

function verificationOptions(fixture, overrides = {}) {
  return {
    attestationPath: fixture.attestationPath,
    configPath: fixture.configPath,
    resultsPath: fixture.resultsPath,
    expectedCommit: COMMIT,
    expectedRunId: RUN_ID,
    expectedRunAttempt: "1",
    expectedRepository: REPOSITORY,
    ...overrides,
  };
}

async function expectVerificationFailure(promise, pattern) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof EvalAttestationVerificationError);
    assert.match(error.message, pattern);
    return true;
  });
}

test("accepts a successful attestation for the exact commit, run, config, and results", async () => {
  const fixture = await createFixture();
  const verified = await verifyEvalAttestation(verificationOptions(fixture));
  assert.equal(verified.workflowRunId, RUN_ID);
});

test("rejects a different release commit, workflow run, or repository", async () => {
  const fixture = await createFixture();
  await expectVerificationFailure(
    verifyEvalAttestation(
      verificationOptions(fixture, {
        expectedCommit: "fedcba9876543210fedcba9876543210fedcba98",
      }),
    ),
    /does not match release commit/,
  );
  await expectVerificationFailure(
    verifyEvalAttestation(verificationOptions(fixture, { expectedRunId: "987654321" })),
    /does not match downloaded run/,
  );
  await expectVerificationFailure(
    verifyEvalAttestation(verificationOptions(fixture, { expectedRunAttempt: "2" })),
    /does not match downloaded attempt/,
  );
  await expectVerificationFailure(
    verifyEvalAttestation(verificationOptions(fixture, { expectedRepository: "owner/other" })),
    /does not match release repository/,
  );
});

test("rejects config or results that changed after the evaluation", async () => {
  const fixture = await createFixture();
  await writeFile(fixture.configPath, "description: changed config\n", "utf8");
  await expectVerificationFailure(
    verifyEvalAttestation(verificationOptions(fixture)),
    /config SHA-256/,
  );

  const secondFixture = await createFixture();
  await writeFile(secondFixture.resultsPath, '{"results":[]}\n', "utf8");
  await expectVerificationFailure(
    verifyEvalAttestation(verificationOptions(secondFixture)),
    /results SHA-256/,
  );
});

test("rejects failed outcomes and malformed result JSON", async () => {
  const fixture = await createFixture();
  const failedAttestation = JSON.parse(await readFile(fixture.attestationPath, "utf8"));
  failedAttestation.outcome = "failure";
  await writeFile(
    fixture.attestationPath,
    `${JSON.stringify(failedAttestation, null, 2)}\n`,
    "utf8",
  );
  await expectVerificationFailure(
    verifyEvalAttestation(verificationOptions(fixture)),
    /outcome is failure/,
  );

  const secondFixture = await createFixture();
  await writeFile(secondFixture.resultsPath, "not json\n", "utf8");
  const malformedAttestation = await createEvalAttestation({
    ...secondFixture.attestation,
    configPath: secondFixture.configPath,
    resultsPath: "eval-results.json",
    resultsFilePath: secondFixture.resultsPath,
  });
  await writeFile(
    secondFixture.attestationPath,
    `${JSON.stringify(malformedAttestation, null, 2)}\n`,
    "utf8",
  );
  await expectVerificationFailure(
    verifyEvalAttestation(verificationOptions(secondFixture)),
    /results file is not valid JSON/,
  );
});

test("rejects malformed attestation fields before trusting hashes", async () => {
  const fixture = await createFixture();
  const malformedAttestation = JSON.parse(await readFile(fixture.attestationPath, "utf8"));
  malformedAttestation.workflowRunId = "not-a-run";
  malformedAttestation.configSha256 = "short";
  await writeFile(
    fixture.attestationPath,
    `${JSON.stringify(malformedAttestation, null, 2)}\n`,
    "utf8",
  );
  await expectVerificationFailure(
    verifyEvalAttestation(verificationOptions(fixture)),
    /workflowRunId must be a positive decimal string/,
  );
});
