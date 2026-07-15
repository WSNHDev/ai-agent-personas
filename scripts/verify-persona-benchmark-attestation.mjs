import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

import {
  PERSONA_BENCHMARK_COMPATIBILITY_MATRIX_URL,
  PERSONA_BENCHMARK_SAMPLE_PLAN_URL,
  PERSONA_BENCHMARK_PROTOCOL_URL,
  PERSONA_BENCHMARK_RESULT_SCHEMA_URL,
  PERSONA_BENCHMARK_WORKLOAD_CATALOG_URL,
  PersonaBenchmarkAttestationError,
  assertValidPersonaBenchmarkAttestation,
  sha256File,
} from "./persona-benchmark-attestation.mjs";
import { derivePersonaRendererPolicySha256 } from "./persona-layer-benchmark-report.mjs";

export class PersonaBenchmarkAttestationVerificationError extends Error {
  constructor(errors) {
    super(
      `Persona benchmark attestation verification failed:\n${errors
        .map((error) => `- ${error}`)
        .join("\n")}`,
    );
    this.name = "PersonaBenchmarkAttestationVerificationError";
    this.errors = errors;
  }
}

export async function verifyPersonaBenchmarkAttestation({
  attestationPath,
  expectedCommit,
  expectedRunId,
  expectedRunAttempt,
  expectedRepository,
  resultSchemaPath = PERSONA_BENCHMARK_RESULT_SCHEMA_URL,
  compatibilityMatrixPath = PERSONA_BENCHMARK_COMPATIBILITY_MATRIX_URL,
  protocolPath = PERSONA_BENCHMARK_PROTOCOL_URL,
  samplePlanPath = PERSONA_BENCHMARK_SAMPLE_PLAN_URL,
  workloadCatalogPath = PERSONA_BENCHMARK_WORKLOAD_CATALOG_URL,
}) {
  let attestation;
  try {
    attestation = JSON.parse(await readFile(attestationPath, "utf8"));
  } catch (error) {
    throw new PersonaBenchmarkAttestationVerificationError([
      `cannot read attestation as JSON: ${error instanceof Error ? error.message : String(error)}`,
    ]);
  }

  try {
    assertValidPersonaBenchmarkAttestation(attestation);
  } catch (error) {
    if (error instanceof PersonaBenchmarkAttestationError) {
      throw new PersonaBenchmarkAttestationVerificationError(error.errors);
    }
    throw error;
  }

  const errors = [];
  if (attestation.commit !== expectedCommit) {
    errors.push(
      `commit ${attestation.commit} does not match release commit ${expectedCommit}`,
    );
  }
  if (attestation.workflowRunId !== String(expectedRunId)) {
    errors.push(
      `workflow run ${attestation.workflowRunId} does not match downloaded run ${expectedRunId}`,
    );
  }
  if (attestation.workflowRunAttempt !== String(expectedRunAttempt)) {
    errors.push(
      `workflow attempt ${attestation.workflowRunAttempt} does not match downloaded attempt ${expectedRunAttempt}`,
    );
  }
  if (attestation.repository !== expectedRepository) {
    errors.push(
      `repository ${attestation.repository} does not match release repository ${expectedRepository}`,
    );
  }
  try {
    const expectedRendererPolicySha256 = derivePersonaRendererPolicySha256({
      id: attestation.benchmark.personaId,
      version: attestation.benchmark.personaVersion,
      manifestSchemaVersion: attestation.benchmark.personaManifestSchemaVersion,
      locale: attestation.benchmark.locale,
      intensity: attestation.benchmark.intensity,
    });
    if (attestation.runtime.rendererPolicySha256 !== expectedRendererPolicySha256) {
      errors.push(
        `renderer policy SHA-256 ${attestation.runtime.rendererPolicySha256} does not match checkout derivation ${expectedRendererPolicySha256}`,
      );
    }
  } catch (error) {
    errors.push(
      `cannot derive renderer policy from checkout: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const actualResultSchemaSha256 = await sha256File(resultSchemaPath);
  const actualCompatibilityMatrixSha256 = await sha256File(compatibilityMatrixPath);
  const actualProtocolSha256 = await sha256File(protocolPath);
  const actualSamplePlanSha256 = await sha256File(samplePlanPath);
  const actualWorkloadCatalogSha256 = await sha256File(workloadCatalogPath);
  if (attestation.resultSchemaSha256 !== actualResultSchemaSha256) {
    errors.push(
      `result schema SHA-256 ${attestation.resultSchemaSha256} does not match ${actualResultSchemaSha256}`,
    );
  }
  if (attestation.compatibilityMatrixSha256 !== actualCompatibilityMatrixSha256) {
    errors.push(
      `compatibility matrix SHA-256 ${attestation.compatibilityMatrixSha256} does not match ${actualCompatibilityMatrixSha256}`,
    );
  }
  if (attestation.protocolSha256 !== actualProtocolSha256) {
    errors.push(
      `protocol SHA-256 ${attestation.protocolSha256} does not match ${actualProtocolSha256}`,
    );
  }
  if (attestation.samplePlanSha256 !== actualSamplePlanSha256) {
    errors.push(
      `sample plan SHA-256 ${attestation.samplePlanSha256} does not match ${actualSamplePlanSha256}`,
    );
  }
  if (attestation.workloadCatalogSha256 !== actualWorkloadCatalogSha256) {
    errors.push(
      `workload catalog SHA-256 ${attestation.workloadCatalogSha256} does not match ${actualWorkloadCatalogSha256}`,
    );
  }

  let matrix;
  try {
    matrix = JSON.parse(await readFile(compatibilityMatrixPath, "utf8"));
  } catch (error) {
    errors.push(
      `compatibility matrix is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (
    matrix &&
    attestation.benchmark.compatibilityMatrixSchemaVersion !== matrix.schemaVersion
  ) {
    errors.push(
      `compatibility matrix schema ${attestation.benchmark.compatibilityMatrixSchemaVersion} ` +
        `does not match ${matrix.schemaVersion}`,
    );
  }

  let samplePlan;
  try {
    samplePlan = JSON.parse(await readFile(samplePlanPath, "utf8"));
  } catch (error) {
    errors.push(
      `sample plan is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (samplePlan) {
    const expectedMinimums = {
      minimumWorkloadPairs: samplePlan.minimumWorkloadPairs,
      minimumCompatibleTaskPairs: samplePlan.minimumCompatibleTaskPairs,
      minimumRatersPerWorkload: samplePlan.minimumRatersPerWorkload,
      minimumTotalRaters: samplePlan.minimumTotalRaters,
    };
    for (const [key, expected] of Object.entries(expectedMinimums)) {
      if (attestation.counts[key] !== expected) {
        errors.push(`counts.${key} ${attestation.counts[key]} does not match ${expected}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new PersonaBenchmarkAttestationVerificationError(errors);
  }
  return attestation;
}

async function main() {
  const { values } = parseArgs({
    options: {
      attestation: { type: "string" },
      commit: { type: "string" },
      "run-id": { type: "string" },
      "run-attempt": { type: "string" },
      repository: { type: "string" },
    },
    strict: true,
  });
  const required = ["attestation", "commit", "run-id", "run-attempt", "repository"];
  const missing = required.filter((name) => !values[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required options: ${missing.map((name) => `--${name}`).join(", ")}`,
    );
  }

  const attestation = await verifyPersonaBenchmarkAttestation({
    attestationPath: values.attestation,
    expectedCommit: values.commit,
    expectedRunId: values["run-id"],
    expectedRunAttempt: values["run-attempt"],
    expectedRepository: values.repository,
  });
  console.log(
    `Verified confirmatory persona benchmark run ${attestation.workflowRunId} ` +
      `for ${attestation.commit}.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
