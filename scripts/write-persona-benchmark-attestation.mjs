import { writeFile } from "node:fs/promises";

import { createPersonaBenchmarkAttestationFromFile } from "./persona-benchmark-attestation.mjs";

const resultPath = process.env.PERSONA_BENCHMARK_RESULT_PATH;
if (!resultPath) {
  throw new Error("PERSONA_BENCHMARK_RESULT_PATH must identify the private result file.");
}
const randomizationMappingPath = process.env.PERSONA_BENCHMARK_RANDOMIZATION_MAPPING_PATH;
if (!randomizationMappingPath) {
  throw new Error(
    "PERSONA_BENCHMARK_RANDOMIZATION_MAPPING_PATH must identify the private randomization mapping.",
  );
}
const raterAttestationPath = process.env.PERSONA_BENCHMARK_RATER_ATTESTATION_PATH;
if (!raterAttestationPath) {
  throw new Error(
    "PERSONA_BENCHMARK_RATER_ATTESTATION_PATH must identify the private rater attestation.",
  );
}
const evaluatorEvidencePath = process.env.PERSONA_BENCHMARK_EVALUATOR_EVIDENCE_PATH;
if (!evaluatorEvidencePath) {
  throw new Error(
    "PERSONA_BENCHMARK_EVALUATOR_EVIDENCE_PATH must identify the private evaluator evidence.",
  );
}

const outputPath =
  process.env.PERSONA_BENCHMARK_ATTESTATION_PATH ?? "persona-benchmark-attestation.json";
const attestation = await createPersonaBenchmarkAttestationFromFile({
  resultPath,
  randomizationMappingPath,
  raterAttestationPath,
  evaluatorEvidencePath,
  commit: process.env.GITHUB_SHA,
  ref: process.env.GITHUB_REF,
  repository: process.env.GITHUB_REPOSITORY,
  workflowRunId: process.env.GITHUB_RUN_ID,
  workflowRunAttempt: process.env.GITHUB_RUN_ATTEMPT,
});

await writeFile(outputPath, `${JSON.stringify(attestation, null, 2)}\n`, "utf8");
console.log(
  `Wrote a confirmatory persona benchmark attestation for ${attestation.commit} ` +
    `(run ${attestation.workflowRunId}).`,
);
