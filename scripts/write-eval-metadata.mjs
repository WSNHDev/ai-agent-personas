import { writeFile } from "node:fs/promises";
import { createEvalAttestation } from "./eval-attestation.mjs";

const attestation = await createEvalAttestation({
  commit: process.env.GITHUB_SHA,
  ref: process.env.GITHUB_REF,
  repository: process.env.GITHUB_REPOSITORY,
  provider: process.env.EVAL_PROVIDER ?? "openai:responses:gpt-5.4-mini",
  outcome: process.env.EVAL_OUTCOME,
  configPath: process.env.EVAL_CONFIG_PATH ?? "evals/promptfooconfig.yaml",
  resultsPath: process.env.EVAL_RESULTS_PATH ?? "eval-results.json",
  workflowRunId: process.env.GITHUB_RUN_ID,
  workflowRunAttempt: process.env.GITHUB_RUN_ATTEMPT,
});

await writeFile(
  "eval-attestation.json",
  `${JSON.stringify(attestation, null, 2)}\n`,
  "utf8",
);
console.log(
  `Wrote ${attestation.outcome} evaluation attestation for ${attestation.commit} (run ${attestation.workflowRunId}).`,
);
