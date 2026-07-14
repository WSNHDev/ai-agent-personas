import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import {
  EvalAttestationError,
  assertValidEvalAttestation,
  sha256File,
} from "./eval-attestation.mjs";
import { readFile } from "node:fs/promises";

export class EvalAttestationVerificationError extends Error {
  constructor(errors) {
    super(`Evaluation attestation verification failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    this.name = "EvalAttestationVerificationError";
    this.errors = errors;
  }
}

function normalizePath(path) {
  return path.replaceAll("\\", "/");
}

export async function verifyEvalAttestation({
  attestationPath,
  configPath,
  resultsPath,
  expectedCommit,
  expectedRunId,
  expectedRunAttempt,
  expectedRepository,
}) {
  let attestation;
  try {
    attestation = JSON.parse(await readFile(attestationPath, "utf8"));
  } catch (error) {
    throw new EvalAttestationVerificationError([
      `cannot read ${attestationPath} as JSON: ${error instanceof Error ? error.message : String(error)}`,
    ]);
  }

  try {
    assertValidEvalAttestation(attestation);
  } catch (error) {
    if (error instanceof EvalAttestationError) {
      throw new EvalAttestationVerificationError(error.errors);
    }
    throw error;
  }

  const errors = [];
  const actualConfigSha256 = await sha256File(configPath);
  const actualResultsSha256 = await sha256File(resultsPath);

  if (attestation.outcome !== "success") {
    errors.push(`evaluation outcome is ${attestation.outcome}, not success`);
  }
  if (attestation.commit !== expectedCommit) {
    errors.push(`commit ${attestation.commit} does not match release commit ${expectedCommit}`);
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
  if (normalizePath(attestation.configPath) !== normalizePath(configPath)) {
    errors.push(`config path ${attestation.configPath} does not match ${configPath}`);
  }
  if (normalizePath(attestation.resultsPath) !== normalizePath(resultsPath.split(/[\\/]/).at(-1))) {
    errors.push(`results path ${attestation.resultsPath} does not identify ${resultsPath}`);
  }
  if (attestation.configSha256 !== actualConfigSha256) {
    errors.push(
      `config SHA-256 ${attestation.configSha256} does not match ${actualConfigSha256}`,
    );
  }
  if (attestation.resultsSha256 !== actualResultsSha256) {
    errors.push(
      `results SHA-256 ${attestation.resultsSha256 ?? "null"} does not match ${actualResultsSha256}`,
    );
  }

  try {
    JSON.parse(await readFile(resultsPath, "utf8"));
  } catch (error) {
    errors.push(
      `results file is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (errors.length > 0) throw new EvalAttestationVerificationError(errors);
  return attestation;
}

async function main() {
  const { values } = parseArgs({
    options: {
      attestation: { type: "string" },
      config: { type: "string" },
      results: { type: "string" },
      commit: { type: "string" },
      "run-id": { type: "string" },
      "run-attempt": { type: "string" },
      repository: { type: "string" },
    },
    strict: true,
  });

  const required = [
    "attestation",
    "config",
    "results",
    "commit",
    "run-id",
    "run-attempt",
    "repository",
  ];
  const missing = required.filter((name) => !values[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required options: ${missing.map((name) => `--${name}`).join(", ")}`);
  }

  const attestation = await verifyEvalAttestation({
    attestationPath: values.attestation,
    configPath: values.config,
    resultsPath: values.results,
    expectedCommit: values.commit,
    expectedRunId: values["run-id"],
    expectedRunAttempt: values["run-attempt"],
    expectedRepository: values.repository,
  });

  console.log(
    `Verified successful evaluation run ${attestation.workflowRunId} for ${attestation.commit}.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
