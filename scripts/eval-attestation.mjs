import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export const EVAL_ATTESTATION_SCHEMA_VERSION = 1;
export const EVAL_OUTCOMES = Object.freeze(["success", "failure", "cancelled", "skipped"]);

const SHA_1_PATTERN = /^[0-9a-f]{40}$/;
const SHA_256_PATTERN = /^[0-9a-f]{64}$/;
const RUN_ID_PATTERN = /^[1-9]\d*$/;
const REPOSITORY_PATTERN = /^[^/\s]+\/[^/\s]+$/;

export class EvalAttestationError extends Error {
  constructor(errors) {
    super(`Invalid evaluation attestation:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    this.name = "EvalAttestationError";
    this.errors = errors;
  }
}

export async function sha256File(path) {
  const contents = await readFile(path);
  return createHash("sha256").update(contents).digest("hex");
}

export function assertValidEvalAttestation(attestation) {
  const errors = [];

  if (!attestation || typeof attestation !== "object" || Array.isArray(attestation)) {
    throw new EvalAttestationError(["attestation must be a JSON object"]);
  }

  if (attestation.schemaVersion !== EVAL_ATTESTATION_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${EVAL_ATTESTATION_SCHEMA_VERSION}`);
  }
  if (!SHA_1_PATTERN.test(attestation.commit ?? "")) {
    errors.push("commit must be a lowercase 40-character Git SHA");
  }
  if (typeof attestation.ref !== "string" || attestation.ref.length === 0) {
    errors.push("ref must be a non-empty string");
  }
  if (!REPOSITORY_PATTERN.test(attestation.repository ?? "")) {
    errors.push("repository must use the owner/name form");
  }
  if (typeof attestation.provider !== "string" || attestation.provider.length === 0) {
    errors.push("provider must be a non-empty string");
  }
  if (!EVAL_OUTCOMES.includes(attestation.outcome)) {
    errors.push(`outcome must be one of: ${EVAL_OUTCOMES.join(", ")}`);
  }
  if (typeof attestation.configPath !== "string" || attestation.configPath.length === 0) {
    errors.push("configPath must be a non-empty string");
  }
  if (!SHA_256_PATTERN.test(attestation.configSha256 ?? "")) {
    errors.push("configSha256 must be a lowercase SHA-256 digest");
  }
  if (typeof attestation.resultsPath !== "string" || attestation.resultsPath.length === 0) {
    errors.push("resultsPath must be a non-empty string");
  }
  if (attestation.resultsSha256 !== null && !SHA_256_PATTERN.test(attestation.resultsSha256 ?? "")) {
    errors.push("resultsSha256 must be null or a lowercase SHA-256 digest");
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

  if (errors.length > 0) throw new EvalAttestationError(errors);
  return attestation;
}

async function optionalSha256File(path) {
  try {
    return await sha256File(path);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return null;
    throw error;
  }
}

export async function createEvalAttestation({
  commit,
  ref,
  repository,
  provider,
  outcome,
  configPath,
  configFilePath = configPath,
  resultsPath,
  resultsFilePath = resultsPath,
  workflowRunId,
  workflowRunAttempt,
  generatedAt = new Date().toISOString(),
}) {
  const attestation = {
    schemaVersion: EVAL_ATTESTATION_SCHEMA_VERSION,
    commit,
    ref,
    repository,
    provider,
    outcome,
    configPath,
    configSha256: await sha256File(configFilePath),
    resultsPath,
    resultsSha256: await optionalSha256File(resultsFilePath),
    workflowRunId: String(workflowRunId),
    workflowRunAttempt: String(workflowRunAttempt),
    generatedAt,
  };

  assertValidEvalAttestation(attestation);

  if (outcome === "success" && attestation.resultsSha256 === null) {
    throw new EvalAttestationError(["a successful evaluation must produce a results file"]);
  }

  return attestation;
}
