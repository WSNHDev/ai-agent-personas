import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import {
  PERSONA_BENCHMARK_COMPATIBILITY_MATRIX_URL,
  PERSONA_BENCHMARK_SAMPLE_PLAN_URL,
  PERSONA_BENCHMARK_PROTOCOL_URL,
  PERSONA_BENCHMARK_RESULT_SCHEMA_URL,
  PERSONA_BENCHMARK_WORKLOAD_CATALOG_URL,
  PersonaBenchmarkAttestationError,
  assertValidPersonaBenchmarkAttestation,
  createPersonaBenchmarkAttestation,
  sha256File,
} from "./persona-benchmark-attestation.mjs";
import {
  PersonaBenchmarkAttestationVerificationError,
  verifyPersonaBenchmarkAttestation,
} from "./verify-persona-benchmark-attestation.mjs";
import { derivePersonaRendererPolicySha256 } from "./persona-layer-benchmark-report.mjs";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const REPOSITORY = "owner/ai-agent-personas";
const RUN_ID = "123456789";
const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

function validatedResult(runKind = "confirmatory") {
  return {
    schemaVersion: 2,
    id: "private-confirmatory-run",
    runKind,
    commit: COMMIT,
    persona: {
      id: "detective",
      version: "2.0.0",
      manifestSchemaVersion: "2.0.0",
      locale: "en",
      intensity: "balanced",
      taskModeId: "detective-root-cause",
    },
    runtime: {
      modelSettingsSha256: "a".repeat(64),
      toolPolicySha256: "b".repeat(64),
      rendererPolicySha256: derivePersonaRendererPolicySha256({
        id: "detective",
        version: "2.0.0",
        manifestSchemaVersion: "2.0.0",
        locale: "en",
        intensity: "balanced",
      }),
      rendererToolPolicySha256: "f".repeat(64),
    },
    protocol: {
      judge: { evaluatorEvidenceSha256: "1".repeat(64) },
      ux: {
        randomizationMappingSha256: "2".repeat(64),
        raterAttestationSha256: "3".repeat(64),
      },
    },
    workloads: [
      { id: "aligned", taskModeCompatible: true },
      { id: "neutral", taskModeCompatible: false },
    ],
    ux: [
      { workloadId: "aligned", raters: 12 },
      { workloadId: "neutral", raters: 12 },
    ],
  };
}

async function createFixture({ runKind = "confirmatory", releaseGate = "pass" } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "persona-benchmark-attestation-"));
  temporaryDirectories.push(directory);
  const attestationPath = join(directory, "persona-benchmark-attestation.json");
  const matrix = JSON.parse(
    await readFile(PERSONA_BENCHMARK_COMPATIBILITY_MATRIX_URL, "utf8"),
  );
  const attestation = createPersonaBenchmarkAttestation({
    result: validatedResult(runKind),
    summary: {
      releaseGate,
      provenance: { verified: true },
      evidenceGuardrails: {
        workloadPairs: 8,
        minimumWorkloadPairs: 8,
        compatibleTaskPairs: 4,
        minimumCompatibleTaskPairs: 4,
        minimumObservedRatersPerWorkload: 8,
        minimumRatersPerWorkload: 8,
        totalRaters: 64,
        minimumTotalRaters: 64,
        sufficient: true,
      },
    },
    resultSha256: "c".repeat(64),
    resultSchemaSha256: await sha256File(PERSONA_BENCHMARK_RESULT_SCHEMA_URL),
    compatibilityMatrixSha256: await sha256File(
      PERSONA_BENCHMARK_COMPATIBILITY_MATRIX_URL,
    ),
    compatibilityMatrixSchemaVersion: matrix.schemaVersion,
    protocolSha256: await sha256File(PERSONA_BENCHMARK_PROTOCOL_URL),
    samplePlanSha256: await sha256File(PERSONA_BENCHMARK_SAMPLE_PLAN_URL),
    workloadCatalogSha256: await sha256File(PERSONA_BENCHMARK_WORKLOAD_CATALOG_URL),
    commit: COMMIT,
    ref: "refs/heads/main",
    repository: REPOSITORY,
    workflowRunId: RUN_ID,
    workflowRunAttempt: "1",
    generatedAt: "2026-07-15T00:00:00.000Z",
  });
  await writeFile(attestationPath, `${JSON.stringify(attestation, null, 2)}\n`, "utf8");
  return { directory, attestationPath, attestation };
}

function verificationOptions(fixture, overrides = {}) {
  return {
    attestationPath: fixture.attestationPath,
    expectedCommit: COMMIT,
    expectedRunId: RUN_ID,
    expectedRunAttempt: "1",
    expectedRepository: REPOSITORY,
    ...overrides,
  };
}

async function expectVerificationFailure(promise, pattern) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof PersonaBenchmarkAttestationVerificationError);
    assert.match(error.message, pattern);
    return true;
  });
}

test("verifies a confirmatory pass for the exact protected workflow run", async () => {
  const fixture = await createFixture();
  const verified = await verifyPersonaBenchmarkAttestation(verificationOptions(fixture));
  assert.equal(verified.releaseGate, "pass");
  assert.equal(verified.runKind, "confirmatory");
  assert.deepEqual(verified.counts, {
    workloadPairs: 8,
    minimumWorkloadPairs: 8,
    compatibleTaskPairs: 4,
    minimumCompatibleTaskPairs: 4,
    minimumObservedRatersPerWorkload: 8,
    minimumRatersPerWorkload: 8,
    totalRaters: 64,
    minimumTotalRaters: 64,
    sufficient: true,
  });
});

test("rejects non-confirmatory or non-passing evidence before writing an attestation", async () => {
  await assert.rejects(
    async () => createFixture({ runKind: "pilot" }),
    (error) => {
      assert.ok(error instanceof PersonaBenchmarkAttestationError);
      assert.match(error.message, /runKind pilot is not confirmatory/u);
      return true;
    },
  );
  await assert.rejects(
    async () => createFixture({ releaseGate: "inconclusive" }),
    /release gate is inconclusive, not pass/u,
  );
});

test("rejects a different release commit, workflow run, attempt, or repository", async () => {
  const fixture = await createFixture();
  await expectVerificationFailure(
    verifyPersonaBenchmarkAttestation(
      verificationOptions(fixture, {
        expectedCommit: "fedcba9876543210fedcba9876543210fedcba98",
      }),
    ),
    /does not match release commit/u,
  );
  await expectVerificationFailure(
    verifyPersonaBenchmarkAttestation(
      verificationOptions(fixture, { expectedRunId: "987654321" }),
    ),
    /does not match downloaded run/u,
  );
  await expectVerificationFailure(
    verifyPersonaBenchmarkAttestation(
      verificationOptions(fixture, { expectedRunAttempt: "2" }),
    ),
    /does not match downloaded attempt/u,
  );
  await expectVerificationFailure(
    verifyPersonaBenchmarkAttestation(
      verificationOptions(fixture, { expectedRepository: "owner/other" }),
    ),
    /does not match release repository/u,
  );
});

test("rejects attestation or tracked-protocol tampering", async () => {
  const fixture = await createFixture();
  const tampered = structuredClone(fixture.attestation);
  tampered.protocolSha256 = "d".repeat(64);
  await writeFile(fixture.attestationPath, `${JSON.stringify(tampered, null, 2)}\n`, "utf8");
  await expectVerificationFailure(
    verifyPersonaBenchmarkAttestation(verificationOptions(fixture)),
    /protocol SHA-256/u,
  );

  const secondFixture = await createFixture();
  const changedProtocolPath = join(secondFixture.directory, "protocol-v2.md");
  await writeFile(changedProtocolPath, "changed protocol\n", "utf8");
  await expectVerificationFailure(
    verifyPersonaBenchmarkAttestation(
      verificationOptions(secondFixture, { protocolPath: changedProtocolPath }),
    ),
    /protocol SHA-256/u,
  );
});

test("attestation schema rejects raw-result paths and additional evidence", async () => {
  const fixture = await createFixture();
  const leaked = { ...fixture.attestation, resultPath: "D:/private/raw-result.json" };
  assert.throws(
    () => assertValidPersonaBenchmarkAttestation(leaked),
    /must contain exactly/u,
  );
  const serialized = JSON.stringify(fixture.attestation);
  assert.doesNotMatch(serialized, /resultPath|prompt|response|rating/u);
});

test("workflow uploads only the attestation and release requires the same-commit gate", async () => {
  const benchmarkWorkflow = await readFile(
    new URL("../.github/workflows/persona-benchmark.yml", import.meta.url),
    "utf8",
  );
  assert.match(benchmarkWorkflow, /runs-on: \[self-hosted, linux, persona-evals\]/u);
  assert.match(benchmarkWorkflow, /environment: model-evaluations/u);
  assert.match(benchmarkWorkflow, /vars\.PERSONA_BENCHMARK_RESULT_PATH/u);
  assert.match(
    benchmarkWorkflow,
    /vars\.PERSONA_BENCHMARK_RANDOMIZATION_MAPPING_PATH/u,
  );
  assert.match(benchmarkWorkflow, /vars\.PERSONA_BENCHMARK_RATER_ATTESTATION_PATH/u);
  assert.match(benchmarkWorkflow, /vars\.PERSONA_BENCHMARK_EVALUATOR_EVIDENCE_PATH/u);
  assert.match(benchmarkWorkflow, /pnpm --filter @ai-agent-personas\/core build/u);
  assert.match(benchmarkWorkflow, /must live outside the repository checkout/u);
  assert.match(
    benchmarkWorkflow,
    /persona-layer-benchmark-report\.mjs[\s\S]*> \/dev\/null 2>&1/u,
  );
  assert.match(benchmarkWorkflow, /--expected-commit "\$GITHUB_SHA"/u);
  assert.match(
    benchmarkWorkflow,
    /--randomization-mapping "\$PERSONA_BENCHMARK_RANDOMIZATION_MAPPING_PATH"/u,
  );
  assert.match(
    benchmarkWorkflow,
    /--rater-attestation "\$PERSONA_BENCHMARK_RATER_ATTESTATION_PATH"/u,
  );
  assert.match(
    benchmarkWorkflow,
    /--evaluator-evidence "\$PERSONA_BENCHMARK_EVALUATOR_EVIDENCE_PATH"/u,
  );
  assert.match(
    benchmarkWorkflow,
    /write-persona-benchmark-attestation\.mjs > \/dev\/null 2>&1/u,
  );
  const uploadStep = benchmarkWorkflow.slice(
    benchmarkWorkflow.indexOf("- name: Upload only the benchmark attestation"),
  );
  assert.match(
    uploadStep,
    /path: \$\{\{ runner\.temp \}\}\/persona-benchmark-attestation\.json/u,
  );
  assert.doesNotMatch(uploadStep, /PERSONA_BENCHMARK_RESULT_PATH|local-results/u);

  const releaseWorkflow = await readFile(
    new URL("../.github/workflows/release.yml", import.meta.url),
    "utf8",
  );
  assert.match(releaseWorkflow, /actions\/workflows\/persona-benchmark\.yml\/runs/u);
  assert.match(releaseWorkflow, /head_sha=\$RELEASE_COMMIT/u);
  assert.match(releaseWorkflow, /verify-persona-benchmark-attestation\.mjs/u);
  assert.match(releaseWorkflow, /artifact must contain only its attestation/u);
  const installIndex = releaseWorkflow.indexOf("- name: Install dependencies");
  const coreBuildIndex = releaseWorkflow.indexOf(
    "- name: Build the canonical core compiler assets",
  );
  const benchmarkVerificationIndex = releaseWorkflow.indexOf(
    "- name: Verify private benchmark provenance and release gate",
  );
  assert.ok(installIndex >= 0, "release workflow must install dependencies");
  assert.ok(
    coreBuildIndex > installIndex,
    "release workflow must build core after installing dependencies",
  );
  assert.ok(
    benchmarkVerificationIndex > coreBuildIndex,
    "release workflow must build core before verifying the benchmark attestation",
  );
  assert.match(
    releaseWorkflow.slice(coreBuildIndex, benchmarkVerificationIndex),
    /pnpm --filter @ai-agent-personas\/core build/u,
  );
  assert.equal(
    releaseWorkflow.match(/- name: Install dependencies/gu)?.length,
    1,
    "release workflow must install dependencies exactly once",
  );
});
