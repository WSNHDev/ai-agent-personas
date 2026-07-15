import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  PERSONA_RENDERER_HOST_TEMPLATE_VERSION,
  derivePersonaRendererPolicySha256,
  personaLayerAggregateUxSha256,
  summarizePersonaLayerBenchmarkResult,
  validatePersonaLayerBenchmarkResult,
} from "./persona-layer-benchmark-report.mjs";

export const PERSONA_BENCHMARK_ATTESTATION_SCHEMA_VERSION = 1;
export const PERSONA_BENCHMARK_PROTOCOL_VERSION = 2;

export const PERSONA_BENCHMARK_COMPATIBILITY_MATRIX_URL = new URL(
  "../benchmarks/persona-overhead/compatibility-matrix-v1.json",
  import.meta.url,
);
export const PERSONA_BENCHMARK_PROTOCOL_URL = new URL(
  "../benchmarks/persona-overhead/protocol-v2.md",
  import.meta.url,
);
export const PERSONA_BENCHMARK_RESULT_SCHEMA_URL = new URL(
  "../benchmarks/persona-overhead/result-v2.schema.json",
  import.meta.url,
);
export const PERSONA_BENCHMARK_SAMPLE_PLAN_URL = new URL(
  "../benchmarks/persona-overhead/sample-plan-v2.json",
  import.meta.url,
);
export const PERSONA_BENCHMARK_WORKLOAD_CATALOG_URL = new URL(
  "../benchmarks/persona-overhead/workload-catalog-v2.json",
  import.meta.url,
);

const SHA_1_PATTERN = /^[0-9a-f]{40}$/u;
const SHA_256_PATTERN = /^[0-9a-f]{64}$/u;
const RUN_ID_PATTERN = /^[1-9][0-9]*$/u;
const REPOSITORY_PATTERN = /^[^/\s]+\/[^/\s]+$/u;
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/u;
const SEMVER_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;

export class PersonaBenchmarkAttestationError extends Error {
  constructor(errors) {
    super(
      `Invalid persona benchmark attestation:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    this.name = "PersonaBenchmarkAttestationError";
    this.errors = errors;
  }
}

export function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

export async function sha256File(path) {
  return sha256(await readFile(path));
}

function exactKeys(value, expected, path, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${path} must be an object`);
    return false;
  }
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(required)) {
    errors.push(`${path} must contain exactly: ${required.join(", ")}`);
    return false;
  }
  return true;
}

function positiveInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

export function assertValidPersonaBenchmarkAttestation(attestation) {
  const errors = [];
  const topLevelKeys = [
    "schemaVersion",
    "repository",
    "commit",
    "ref",
    "workflowRunId",
    "workflowRunAttempt",
    "generatedAt",
    "outcome",
    "releaseGate",
    "runKind",
    "benchmark",
    "runtime",
    "privateEvidence",
    "resultSha256",
    "resultSchemaSha256",
    "compatibilityMatrixSha256",
    "protocolSha256",
    "samplePlanSha256",
    "workloadCatalogSha256",
    "counts",
  ];
  if (!exactKeys(attestation, topLevelKeys, "attestation", errors)) {
    throw new PersonaBenchmarkAttestationError(errors);
  }

  if (attestation.schemaVersion !== PERSONA_BENCHMARK_ATTESTATION_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${PERSONA_BENCHMARK_ATTESTATION_SCHEMA_VERSION}`);
  }
  if (!REPOSITORY_PATTERN.test(attestation.repository ?? "")) {
    errors.push("repository must use the owner/name form");
  }
  if (!SHA_1_PATTERN.test(attestation.commit ?? "")) {
    errors.push("commit must be a lowercase 40-character Git SHA");
  }
  if (typeof attestation.ref !== "string" || attestation.ref.length === 0) {
    errors.push("ref must be a non-empty string");
  }
  if (!RUN_ID_PATTERN.test(attestation.workflowRunId ?? "")) {
    errors.push("workflowRunId must be a positive decimal string");
  }
  if (!RUN_ID_PATTERN.test(attestation.workflowRunAttempt ?? "")) {
    errors.push("workflowRunAttempt must be a positive decimal string");
  }
  if (
    typeof attestation.generatedAt !== "string" ||
    Number.isNaN(Date.parse(attestation.generatedAt))
  ) {
    errors.push("generatedAt must be an ISO-compatible timestamp");
  }
  if (attestation.outcome !== "success") errors.push("outcome must be success");
  if (attestation.releaseGate !== "pass") errors.push("releaseGate must be pass");
  if (attestation.runKind !== "confirmatory") errors.push("runKind must be confirmatory");

  if (
    exactKeys(
      attestation.benchmark,
      [
        "id",
        "resultSchemaVersion",
        "protocolVersion",
        "compatibilityMatrixSchemaVersion",
        "personaId",
        "personaVersion",
        "personaManifestSchemaVersion",
        "locale",
        "intensity",
        "taskModeId",
      ],
      "attestation.benchmark",
      errors,
    )
  ) {
    if (!ID_PATTERN.test(attestation.benchmark.id ?? "")) {
      errors.push("benchmark.id must be a valid identifier");
    }
    if (attestation.benchmark.resultSchemaVersion !== 2) {
      errors.push("benchmark.resultSchemaVersion must be 2");
    }
    if (attestation.benchmark.protocolVersion !== PERSONA_BENCHMARK_PROTOCOL_VERSION) {
      errors.push(`benchmark.protocolVersion must be ${PERSONA_BENCHMARK_PROTOCOL_VERSION}`);
    }
    if (!SEMVER_PATTERN.test(attestation.benchmark.compatibilityMatrixSchemaVersion ?? "")) {
      errors.push("benchmark.compatibilityMatrixSchemaVersion must be x.y.z");
    }
    if (!ID_PATTERN.test(attestation.benchmark.personaId ?? "")) {
      errors.push("benchmark.personaId must be a valid identifier");
    }
    if (!SEMVER_PATTERN.test(attestation.benchmark.personaVersion ?? "")) {
      errors.push("benchmark.personaVersion must be x.y.z");
    }
    if (!SEMVER_PATTERN.test(attestation.benchmark.personaManifestSchemaVersion ?? "")) {
      errors.push("benchmark.personaManifestSchemaVersion must be x.y.z");
    }
    if (!["en", "ru"].includes(attestation.benchmark.locale)) {
      errors.push("benchmark.locale must be en or ru");
    }
    if (!["subtle", "balanced", "immersive"].includes(attestation.benchmark.intensity)) {
      errors.push("benchmark.intensity must be a supported Voice intensity");
    }
    if (!ID_PATTERN.test(attestation.benchmark.taskModeId ?? "")) {
      errors.push("benchmark.taskModeId must be a valid identifier");
    }
  }

  if (
    exactKeys(
      attestation.runtime,
      [
        "modelSettingsSha256",
        "toolPolicySha256",
        "rendererPolicySha256",
        "rendererToolPolicySha256",
        "rendererPolicyHostTemplateVersion",
      ],
      "attestation.runtime",
      errors,
    )
  ) {
    for (const key of [
      "modelSettingsSha256",
      "toolPolicySha256",
      "rendererPolicySha256",
      "rendererToolPolicySha256",
    ]) {
      if (!SHA_256_PATTERN.test(attestation.runtime[key] ?? "")) {
        errors.push(`runtime.${key} must be a lowercase SHA-256 digest`);
      }
    }
    if (attestation.runtime.rendererPolicyHostTemplateVersion !== PERSONA_RENDERER_HOST_TEMPLATE_VERSION) {
      errors.push(
        `runtime.rendererPolicyHostTemplateVersion must be ${PERSONA_RENDERER_HOST_TEMPLATE_VERSION}`,
      );
    }
  }

  if (
    exactKeys(
      attestation.privateEvidence,
      [
        "randomizationMappingSha256",
        "raterAttestationSha256",
        "evaluatorEvidenceSha256",
        "aggregateUxSha256",
      ],
      "attestation.privateEvidence",
      errors,
    )
  ) {
    for (const key of [
      "randomizationMappingSha256",
      "raterAttestationSha256",
      "evaluatorEvidenceSha256",
      "aggregateUxSha256",
    ]) {
      if (!SHA_256_PATTERN.test(attestation.privateEvidence[key] ?? "")) {
        errors.push(`privateEvidence.${key} must be a lowercase SHA-256 digest`);
      }
    }
  }

  for (const key of [
    "resultSha256",
    "resultSchemaSha256",
    "compatibilityMatrixSha256",
    "protocolSha256",
    "samplePlanSha256",
    "workloadCatalogSha256",
  ]) {
    if (!SHA_256_PATTERN.test(attestation[key] ?? "")) {
      errors.push(`${key} must be a lowercase SHA-256 digest`);
    }
  }

  if (
    exactKeys(
      attestation.counts,
      [
        "workloadPairs",
        "minimumWorkloadPairs",
        "compatibleTaskPairs",
        "minimumCompatibleTaskPairs",
        "minimumObservedRatersPerWorkload",
        "minimumRatersPerWorkload",
        "totalRaters",
        "minimumTotalRaters",
        "sufficient",
      ],
      "attestation.counts",
      errors,
    )
  ) {
    for (const key of [
      "workloadPairs",
      "minimumWorkloadPairs",
      "compatibleTaskPairs",
      "minimumCompatibleTaskPairs",
      "minimumObservedRatersPerWorkload",
      "minimumRatersPerWorkload",
      "totalRaters",
      "minimumTotalRaters",
    ]) {
      if (!positiveInteger(attestation.counts[key])) {
        errors.push(`counts.${key} must be a non-negative integer`);
      }
    }
    if (attestation.counts.workloadPairs < 1) {
      errors.push("counts.workloadPairs must be at least 1");
    }
    for (const key of [
      "minimumWorkloadPairs",
      "minimumCompatibleTaskPairs",
      "minimumRatersPerWorkload",
      "minimumTotalRaters",
    ]) {
      if (attestation.counts[key] < 1) {
        errors.push(`counts.${key} must be at least 1`);
      }
    }
    if (attestation.counts.compatibleTaskPairs > attestation.counts.workloadPairs) {
      errors.push("counts.compatibleTaskPairs cannot exceed counts.workloadPairs");
    }
    if (attestation.counts.minimumCompatibleTaskPairs > attestation.counts.minimumWorkloadPairs) {
      errors.push("counts.minimumCompatibleTaskPairs cannot exceed counts.minimumWorkloadPairs");
    }
    if (attestation.counts.workloadPairs < attestation.counts.minimumWorkloadPairs) {
      errors.push("counts.workloadPairs must meet counts.minimumWorkloadPairs");
    }
    if (
      attestation.counts.compatibleTaskPairs <
      attestation.counts.minimumCompatibleTaskPairs
    ) {
      errors.push(
        "counts.compatibleTaskPairs must meet counts.minimumCompatibleTaskPairs",
      );
    }
    if (
      attestation.counts.minimumObservedRatersPerWorkload <
      attestation.counts.minimumRatersPerWorkload
    ) {
      errors.push(
        "counts.minimumObservedRatersPerWorkload must meet counts.minimumRatersPerWorkload",
      );
    }
    if (attestation.counts.totalRaters < attestation.counts.minimumTotalRaters) {
      errors.push("counts.totalRaters must meet counts.minimumTotalRaters");
    }
    if (attestation.counts.sufficient !== true) {
      errors.push("counts.sufficient must be true");
    }
  }

  if (errors.length > 0) throw new PersonaBenchmarkAttestationError(errors);
  return attestation;
}

export function createPersonaBenchmarkAttestation({
  result,
  summary,
  resultSha256,
  resultSchemaSha256,
  compatibilityMatrixSha256,
  compatibilityMatrixSchemaVersion,
  protocolSha256,
  samplePlanSha256,
  workloadCatalogSha256,
  commit,
  ref,
  repository,
  workflowRunId,
  workflowRunAttempt,
  generatedAt = new Date().toISOString(),
}) {
  const errors = [];
  if (result.commit !== commit) {
    errors.push(`result commit ${result.commit} does not match checked-out commit ${commit}`);
  }
  if (result.runKind !== "confirmatory") {
    errors.push(`runKind ${result.runKind} is not confirmatory`);
  }
  if (summary.releaseGate !== "pass") {
    errors.push(`release gate is ${summary.releaseGate}, not pass`);
  }
  if (summary.provenance?.verified !== true) {
    errors.push("private benchmark provenance is not fully verified");
  }
  const expectedRendererPolicySha256 = derivePersonaRendererPolicySha256(result.persona);
  if (result.runtime.rendererPolicySha256 !== expectedRendererPolicySha256) {
    errors.push("renderer policy does not match the canonical checkout derivation");
  }
  if (errors.length > 0) throw new PersonaBenchmarkAttestationError(errors);

  const attestation = {
    schemaVersion: PERSONA_BENCHMARK_ATTESTATION_SCHEMA_VERSION,
    repository,
    commit,
    ref,
    workflowRunId: String(workflowRunId),
    workflowRunAttempt: String(workflowRunAttempt),
    generatedAt,
    outcome: "success",
    releaseGate: "pass",
    runKind: "confirmatory",
    benchmark: {
      id: result.id,
      resultSchemaVersion: result.schemaVersion,
      protocolVersion: PERSONA_BENCHMARK_PROTOCOL_VERSION,
      compatibilityMatrixSchemaVersion,
      personaId: result.persona.id,
      personaVersion: result.persona.version,
      personaManifestSchemaVersion: result.persona.manifestSchemaVersion,
      locale: result.persona.locale,
      intensity: result.persona.intensity,
      taskModeId: result.persona.taskModeId,
    },
    runtime: {
      modelSettingsSha256: result.runtime.modelSettingsSha256,
      toolPolicySha256: result.runtime.toolPolicySha256,
      rendererPolicySha256: result.runtime.rendererPolicySha256,
      rendererToolPolicySha256: result.runtime.rendererToolPolicySha256,
      rendererPolicyHostTemplateVersion: PERSONA_RENDERER_HOST_TEMPLATE_VERSION,
    },
    privateEvidence: {
      randomizationMappingSha256: result.protocol.ux.randomizationMappingSha256,
      raterAttestationSha256: result.protocol.ux.raterAttestationSha256,
      evaluatorEvidenceSha256: result.protocol.judge.evaluatorEvidenceSha256,
      aggregateUxSha256: personaLayerAggregateUxSha256(result.ux),
    },
    resultSha256,
    resultSchemaSha256,
    compatibilityMatrixSha256,
    protocolSha256,
    samplePlanSha256,
    workloadCatalogSha256,
    counts: { ...summary.evidenceGuardrails },
  };

  return assertValidPersonaBenchmarkAttestation(attestation);
}

export async function createPersonaBenchmarkAttestationFromFile({
  resultPath,
  randomizationMappingPath,
  raterAttestationPath,
  evaluatorEvidencePath,
  commit,
  ref,
  repository,
  workflowRunId,
  workflowRunAttempt,
  generatedAt,
  resultSchemaPath = PERSONA_BENCHMARK_RESULT_SCHEMA_URL,
  compatibilityMatrixPath = PERSONA_BENCHMARK_COMPATIBILITY_MATRIX_URL,
  protocolPath = PERSONA_BENCHMARK_PROTOCOL_URL,
  samplePlanPath = PERSONA_BENCHMARK_SAMPLE_PLAN_URL,
  workloadCatalogPath = PERSONA_BENCHMARK_WORKLOAD_CATALOG_URL,
}) {
  const [resultContents, randomizationMappingContents, raterAttestationContents, evaluatorEvidenceContents] =
    await Promise.all([
      readFile(resultPath),
      readFile(randomizationMappingPath),
      readFile(raterAttestationPath),
      readFile(evaluatorEvidencePath),
    ]);
  const result = validatePersonaLayerBenchmarkResult(
    JSON.parse(resultContents.toString("utf8")),
  );
  const summary = summarizePersonaLayerBenchmarkResult(result, {
    expectedCommit: commit,
    randomizationMappingContents,
    raterAttestationContents,
    evaluatorEvidenceContents,
  });
  const matrixContents = await readFile(compatibilityMatrixPath);
  const matrix = JSON.parse(matrixContents.toString("utf8"));

  return createPersonaBenchmarkAttestation({
    result,
    summary,
    resultSha256: sha256(resultContents),
    resultSchemaSha256: await sha256File(resultSchemaPath),
    compatibilityMatrixSha256: sha256(matrixContents),
    compatibilityMatrixSchemaVersion: matrix.schemaVersion,
    protocolSha256: await sha256File(protocolPath),
    samplePlanSha256: await sha256File(samplePlanPath),
    workloadCatalogSha256: await sha256File(workloadCatalogPath),
    commit,
    ref,
    repository,
    workflowRunId,
    workflowRunAttempt,
    generatedAt,
  });
}
