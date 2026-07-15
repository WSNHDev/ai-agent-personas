import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  parsePersonaOverheadCliArgs,
  renderPersonaOverheadMarkdown,
  summarizePersonaOverheadResult,
  validatePersonaOverheadResult,
} from "./persona-overhead-report.mjs";

const scriptPath = fileURLToPath(new URL("./persona-overhead-report.mjs", import.meta.url));
const examplePath = fileURLToPath(
  new URL("../benchmarks/persona-overhead/result.example.json", import.meta.url),
);

function stepIds() {
  return ["setup", ...Array.from({ length: 28 }, (_, index) => `round-${index + 1}`), "final"];
}

function fixture() {
  return {
    schemaVersion: 1,
    id: "synthetic-test",
    runKind: "protocol-validation",
    commit: "0123456789abcdef0123456789abcdef01234567",
    workload: {
      id: "repository-audit-v1",
      scheduledSteps: 30,
      scheduledStepIds: stepIds(),
      controlPayloadSha256: "1".repeat(64),
      personaPayloadSha256: "2".repeat(64),
      effectiveInstructionsSha256: "3".repeat(64),
      roundArtifactsRetained: true,
    },
    runtime: {
      surface: "synthetic-runtime",
      model: "synthetic-model",
      modelConfigurationSha256: "a".repeat(64),
      toolPolicySha256: "b".repeat(64),
      sameConfigurationAcrossArms: true,
      timingMode: "counterbalanced-sequential",
      launchOrder: "control-first",
      actualModelRequestsAvailable: false,
    },
    persona: {
      id: "synthetic-persona",
      locale: "en",
      intensity: "balanced",
      format: "text",
      compiledPromptSha256: "4".repeat(64),
      compiledPromptBytes: 5_000,
    },
    arms: {
      control: {
        status: "complete",
        executedStepIds: stepIds(),
        roundArtifactSha256: "6".repeat(64),
        tokens: 200_000,
        elapsedSeconds: 1_000,
        modelRequests: null,
        taskQualityScore: 73,
        taskQualityBreakdown: {
          "factual-accuracy-and-evidence": 30,
          "coverage-and-prioritization": 18,
          "actionable-usefulness": 15,
          "calibration-and-unsupported-claims": 10,
        },
        processErrors: 2,
        selfCorrections: 1,
        failureReason: null,
      },
      persona: {
        status: "complete",
        executedStepIds: stepIds(),
        roundArtifactSha256: "7".repeat(64),
        tokens: 250_000,
        elapsedSeconds: 1_200,
        modelRequests: null,
        taskQualityScore: 75,
        taskQualityBreakdown: {
          "factual-accuracy-and-evidence": 31,
          "coverage-and-prioritization": 19,
          "actionable-usefulness": 15,
          "calibration-and-unsupported-claims": 10,
        },
        processErrors: 4,
        selfCorrections: 3,
        failureReason: null,
      },
    },
    quality: {
      labelBlinded: true,
      rubricMaximum: 100,
      rubric: [
        { id: "factual-accuracy-and-evidence", maximum: 40 },
        { id: "coverage-and-prioritization", maximum: 25 },
        { id: "actionable-usefulness", maximum: 20 },
        { id: "calibration-and-unsupported-claims", maximum: 15 },
      ],
      nonInferiorityMargin: 3,
      evaluatorModel: "synthetic-judge",
      evaluatorPayloadSha256: "8".repeat(64),
      artifactSha256: "5".repeat(64),
      armMappingSha256: "9".repeat(64),
    },
  };
}

test("computes paired token, time, quality, and executed-step metrics", () => {
  const summary = summarizePersonaOverheadResult(fixture());

  assert.equal(summary.comparable, true);
  assert.equal(summary.tokenDelta, 50_000);
  assert.equal(summary.tokenOverheadPercent, 25);
  assert.equal(summary.tokenRatio, 1.25);
  assert.equal(summary.controlTokensPerStep, 6666.7);
  assert.equal(summary.personaTokensPerStep, 8333.3);
  assert.equal(summary.elapsedOverheadPercent, 20);
  assert.equal(summary.qualityDelta, 2);
  assert.equal(summary.qualityNonInferiorityPassed, true);
  assert.equal(summary.modelRequestDelta, null);
  assert.equal("qualityAdjustedTokenRatio" in summary, false);
});

test("retains incomplete arms without calculating paired ratios", () => {
  const result = fixture();
  Object.assign(result.arms.persona, {
    status: "failed",
    executedStepIds: stepIds().slice(0, 17),
    tokens: 120_000,
    elapsedSeconds: 600,
    taskQualityScore: null,
    taskQualityBreakdown: null,
    failureReason: "Synthetic tool failure.",
  });

  const summary = summarizePersonaOverheadResult(result);
  assert.equal(summary.comparable, false);
  assert.equal(summary.tokenDelta, null);
  assert.equal(summary.tokenRatio, null);
  assert.equal(summary.personaTokensPerStep, 7058.8);
  assert.match(
    renderPersonaOverheadMarkdown(result, summary),
    /paired comparisons were not calculated/,
  );
});

test("validates identifiers, hashes, complete-step accounting, and failure reasons", () => {
  const invalidCommit = fixture();
  invalidCommit.commit = "main";
  assert.throws(() => validatePersonaOverheadResult(invalidCommit), /commit has an invalid format/);

  const skippedStep = fixture();
  skippedStep.arms.control.executedStepIds = stepIds().slice(0, 29);
  assert.throws(() => validatePersonaOverheadResult(skippedStep), /every scheduled step/);

  const missingFailure = fixture();
  missingFailure.arms.persona.status = "blocked";
  missingFailure.arms.persona.executedStepIds = stepIds().slice(0, 12);
  assert.throws(() => validatePersonaOverheadResult(missingFailure), /failureReason/);

  const unexpectedField = fixture();
  unexpectedField.runtime.reasoningEffort = "unknown";
  assert.throws(() => validatePersonaOverheadResult(unexpectedField), /unexpected keys/);

  const missingNullableField = fixture();
  delete missingNullableField.arms.control.failureReason;
  assert.throws(() => validatePersonaOverheadResult(missingNullableField), /missing required keys/);

  const badBreakdown = fixture();
  badBreakdown.arms.control.taskQualityBreakdown["calibration-and-unsupported-claims"] = 9;
  assert.throws(() => validatePersonaOverheadResult(badBreakdown), /must sum/);

  const unexpectedRequestCount = fixture();
  unexpectedRequestCount.arms.control.modelRequests = 30;
  assert.throws(
    () => validatePersonaOverheadResult(unexpectedRequestCount),
    /must be null when request counts are unavailable/,
  );
});

test("accepts an unscored failed pair and rejects incomparable configuration", () => {
  const result = fixture();
  result.runtime.sameConfigurationAcrossArms = false;
  result.arms.control.taskQualityScore = null;
  result.arms.control.taskQualityBreakdown = null;
  Object.assign(result.arms.persona, {
    status: "failed",
    executedStepIds: stepIds().slice(0, 3),
    tokens: null,
    elapsedSeconds: null,
    taskQualityScore: null,
    taskQualityBreakdown: null,
    failureReason: "Synthetic startup failure.",
  });
  result.quality.labelBlinded = false;
  result.quality.evaluatorModel = null;
  result.quality.evaluatorPayloadSha256 = null;
  result.quality.artifactSha256 = null;
  result.quality.armMappingSha256 = null;

  const summary = summarizePersonaOverheadResult(result);
  assert.equal(summary.comparable, false);
  assert.equal(summary.qualityDelta, null);
  assert.equal(summary.qualityNonInferiorityPassed, null);
  assert.equal(summary.qualityLabelBlinded, false);
});

test("renders a compact label-blinded Markdown comparison", () => {
  const result = fixture();
  const markdown = renderPersonaOverheadMarkdown(
    result,
    summarizePersonaOverheadResult(result),
    "synthetic.json",
  );

  assert.match(markdown, /synthetic-persona\/en\/balanced/);
  assert.match(markdown, /\+25%/);
  assert.match(markdown, /Label-blinded task-quality score/);
  assert.match(markdown, /Quality non-inferiority: \*\*pass\*\*/);
  assert.doesNotMatch(markdown, /quality-adjusted/i);
});

test("suppresses quality comparisons for a scored failed arm", () => {
  const result = fixture();
  Object.assign(result.arms.persona, {
    status: "failed",
    executedStepIds: stepIds().slice(0, 20),
    failureReason: "Synthetic interrupted run.",
  });

  const summary = summarizePersonaOverheadResult(result);
  assert.equal(summary.comparable, false);
  assert.equal(summary.qualityDelta, null);
  assert.equal(summary.qualityNonInferiorityPassed, null);
});

test("suppresses comparisons and explains a scored configuration mismatch", () => {
  const result = fixture();
  result.runtime.sameConfigurationAcrossArms = false;

  const summary = summarizePersonaOverheadResult(result);
  assert.equal(summary.comparable, false);
  assert.equal(summary.qualityDelta, null);
  assert.equal(summary.qualityNonInferiorityPassed, null);
  assert.match(
    renderPersonaOverheadMarkdown(result, summary),
    /different runtime configurations/,
  );
});

test("reports actual model-request counts when the runtime exposes them", () => {
  const result = fixture();
  result.runtime.actualModelRequestsAvailable = true;
  result.arms.control.modelRequests = 31;
  result.arms.persona.modelRequests = 34;

  const summary = summarizePersonaOverheadResult(result);
  assert.equal(summary.modelRequestDelta, 3);
  assert.equal(summary.modelRequestRatio, 1.097);
});

test("parses one path and rejects unknown options or extra paths", () => {
  assert.deepEqual(parsePersonaOverheadCliArgs(["--", "result.json", "--json"], {}), {
    help: false,
    jsonOutput: true,
    requestedPath: "result.json",
  });
  assert.throws(() => parsePersonaOverheadCliArgs(["--wat"], {}), /Unknown option/);
  assert.throws(
    () => parsePersonaOverheadCliArgs(["one.json", "two.json"], {}),
    /at most one result path/,
  );
});

test("validates the tracked synthetic example through the CLI", async () => {
  const parsedExample = JSON.parse(await readFile(examplePath, "utf8"));
  assert.doesNotThrow(() => validatePersonaOverheadResult(parsedExample));

  const cli = spawnSync(process.execPath, [scriptPath, examplePath, "--json"], {
    encoding: "utf8",
  });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(JSON.parse(cli.stdout).comparable, true);
});

test("CLI reports usage and exits non-zero when no private result is selected", () => {
  const env = { ...process.env };
  delete env.PERSONA_OVERHEAD_RESULT;
  const cli = spawnSync(process.execPath, [scriptPath], { encoding: "utf8", env });
  assert.equal(cli.status, 1);
  assert.match(cli.stderr, /Usage: pnpm benchmark:persona-overhead/);
});
