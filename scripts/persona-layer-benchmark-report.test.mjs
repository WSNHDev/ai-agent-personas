import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

import {
  PERSONA_LAYER_BOOTSTRAP_CONTRACT,
  PERSONA_LAYER_SAMPLE_PLAN_SHA256,
  PERSONA_LAYER_PROTOCOL_SHA256,
  PERSONA_LAYER_WORKLOAD_CATALOG_SHA256,
  PERSONA_RENDERER_PERSONAS_SOURCE,
  PERSONA_RENDERER_REQUEST_ENCODING_VERSION,
  derivePersonaRendererPolicy,
  derivePersonaRendererPolicySha256,
  encodePersonaRendererRequest,
  personaLayerAggregateUxSha256,
  parsePersonaLayerBenchmarkCliArgs,
  renderPersonaLayerBenchmarkMarkdown,
  summarizePersonaLayerBenchmarkResult,
  validatePersonaLayerBenchmarkResult,
} from "./persona-layer-benchmark-report.mjs";
import {
  PERSONA_TASK_COMPATIBILITY_MATRIX,
  PERSONA_TASK_COMPATIBILITY_MATRIX_SHA256,
  PERSONA_TASK_MODE_CATALOG,
  validatePersonaTaskCompatibilityCatalog,
} from "./persona-task-compatibility.mjs";

const scriptPath = fileURLToPath(new URL("./persona-layer-benchmark-report.mjs", import.meta.url));
const writeAttestationScriptPath = fileURLToPath(
  new URL("./write-persona-benchmark-attestation.mjs", import.meta.url),
);
const requireFromCore = createRequire(new URL("../packages/core/package.json", import.meta.url));
const Ajv2020 = requireFromCore("ajv/dist/2020").default;
const resultSchema = JSON.parse(
  readFileSync(new URL("../benchmarks/persona-overhead/result-v2.schema.json", import.meta.url), "utf8"),
);
const validateResultSchema = new Ajv2020({ strict: false }).compile(resultSchema);
const PAYLOAD_BY_SHA256 = new Map();

function evidencePayload(label, suppliedContents = null) {
  const contents = suppliedContents ?? Buffer.from(`synthetic-private-evidence:${label}`, "utf8");
  const digest = createHash("sha256").update(contents).digest("hex");
  PAYLOAD_BY_SHA256.set(digest, contents.toString("base64"));
  return { sha256: digest, base64: contents.toString("base64") };
}

function whitespaceWordCount(contents) {
  const text = contents.toString("utf8").trim();
  return text.length === 0 ? 0 : text.split(/\s+/u).length;
}

const MODEL_SETTINGS = evidencePayload("model-settings");
const SOLVER_TOOL_POLICY = evidencePayload("solver-tool-policy");
const RENDERER_TOOL_POLICY = evidencePayload("renderer-tool-policy");
const JUDGE_CONFIGURATION = evidencePayload("judge-configuration");
const JUDGE_RUBRIC = evidencePayload("judge-rubric");
const JUDGE_PAYLOAD = evidencePayload("judge-payload");
const JUDGE_PAYLOAD_SHA256 = JUDGE_PAYLOAD.sha256;
const BENCHMARK_PERSONA = {
  id: "detective",
  version: "2.0.0",
  manifestSchemaVersion: "2.0.0",
  locale: "en",
  intensity: "balanced",
};
const RENDERER_POLICY_SHA256 = derivePersonaRendererPolicySha256(BENCHMARK_PERSONA);
const RENDERER_TOOL_POLICY_SHA256 = RENDERER_TOOL_POLICY.sha256;

const FIXTURES = [
  ["aligned-a", "detective-investigation-a", "persona-aligned-investigation-v2.md", "debugging", "persona-aligned", "1"],
  ["aligned-b", "detective-investigation-b", "persona-aligned-investigation-v2-b.md", "debugging", "persona-aligned", "2"],
  ["aligned-c", "detective-investigation-c", "persona-aligned-investigation-v2-c.md", "debugging", "persona-aligned", "3"],
  ["aligned-d", "detective-investigation-d", "persona-aligned-investigation-v2-d.md", "debugging", "persona-aligned", "4"],
  ["neutral-a", "detective-extraction-a", "persona-neutral-extraction-v2.md", "strict-extraction", "persona-neutral", "7"],
  ["neutral-b", "detective-extraction-b", "persona-neutral-extraction-v2-b.md", "strict-extraction", "persona-neutral", "8"],
  ["neutral-c", "detective-extraction-c", "persona-neutral-extraction-v2-c.md", "strict-extraction", "persona-neutral", "9"],
  ["neutral-d", "detective-extraction-d", "persona-neutral-extraction-v2-d.md", "strict-extraction", "persona-neutral", "a"],
].map(([id, fixtureId, file, family, alignment, hashCharacter]) => ({
  id,
  fixtureId,
  file,
  family,
  alignment,
  hashCharacter,
}));

function fileSha256(url) {
  return createHash("sha256").update(readFileSync(url)).digest("hex");
}

function canonicalCompilerRendererSourceForTest() {
  const source = readFileSync(
    new URL("../packages/core/src/compiler.ts", import.meta.url),
    "utf8",
  ).replace(/\r\n?/gu, "\n");
  const extract = (startMarker, endMarker) => {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.ok(start >= 0 && end >= 0, `${startMarker} must precede ${endMarker}`);
    return source.slice(start, end).trimEnd();
  };
  return [
    extract("function wordCount(", "function assertPromptLength("),
    extract("function nonEmptyParagraphCount(", "function voiceRuntimeControl("),
    extract("function voiceRuntimeControl(", "function voiceMessages("),
    extract("function voiceMessages(", "export function buildPersonaVoiceMessagesManifest("),
  ].join("\n\n");
}

function stage(label, words, tokens = 100, seconds = 10) {
  const artifact = evidencePayload(`${label}:artifact`);
  const promptContents = Buffer.from(
    Array.from({ length: words }, (_, index) =>
      index === 0 ? `synthetic-private-prompt:${label}` : `word-${index}`,
    ).join(" "),
    "utf8",
  );
  const prompt = evidencePayload(`${label}:prompt`, promptContents);
  return {
    artifactSha256: artifact.sha256,
    promptSha256: prompt.sha256,
    promptBytes: promptContents.length,
    promptWords: whitespaceWordCount(promptContents),
    modelRequests: 1,
    tokens: { input: tokens, cachedInput: 0, reasoning: 0, output: 20 },
    elapsedSeconds: seconds,
  };
}

function rendererStage(label, words, inputArtifactSha256, tokens = 5, seconds = 1) {
  const base = stage(label, words, tokens, seconds);
  const solverArtifact = Buffer.from(PAYLOAD_BY_SHA256.get(inputArtifactSha256), "base64");
  const promptContents = encodePersonaRendererRequest(BENCHMARK_PERSONA, solverArtifact);
  const prompt = evidencePayload(`${label}:canonical-renderer-prompt`, promptContents);
  return {
    ...base,
    promptSha256: prompt.sha256,
    promptBytes: promptContents.length,
    promptWords: whitespaceWordCount(promptContents),
    inputArtifactSha256,
    rendererPolicySha256: RENDERER_POLICY_SHA256,
    toolsEnabled: false,
    toolPolicySha256: RENDERER_TOOL_POLICY_SHA256,
  };
}

function quality(score = 90) {
  return {
    score,
    maximum: 100,
    judge: "hybrid",
    judgePayloadSha256: JUDGE_PAYLOAD_SHA256,
  };
}

function arm(selection, solver, renderer = null, score = 90) {
  return {
    selection,
    solver,
    renderer,
    taskQuality: quality(score),
    safety: { criticalFailures: [], nonCriticalFailures: 0 },
    excludedReason: null,
  };
}

function workload(definition) {
  const controlSolver = stage(`${definition.id}:control-solver`, 40);
  const taskSolver = stage(`${definition.id}:task-solver`, 120, 110);
  const taskVoice = arm(
    { solver: "task", renderer: "voice", taskModeId: "detective-root-cause" },
    taskSolver,
    rendererStage(`${definition.id}:task-renderer`, 160, taskSolver.artifactSha256),
    92,
  );
  if (definition.alignment !== "persona-aligned") {
    taskVoice.excludedReason = "The preregistered Task mode is not compatible with this workload.";
  }
  return {
    id: definition.id,
    family: definition.family,
    fixtureId: definition.fixtureId,
    fixtureSha256: fileSha256(
      new URL(`../benchmarks/persona-overhead/workloads/${definition.file}`, import.meta.url),
    ),
    alignment: definition.alignment,
    taskModeCompatible: definition.alignment === "persona-aligned",
    arms: {
      control: arm(
        { solver: "neutral", renderer: "neutral", taskModeId: null },
        controlSolver,
      ),
      "length-matched-neutral": arm(
        { solver: "length-matched-neutral", renderer: "neutral", taskModeId: null },
        stage(`${definition.id}:length-neutral`, 200, 105),
      ),
      "legacy-global": arm(
        { solver: "legacy", renderer: "neutral", taskModeId: null },
        stage(`${definition.id}:legacy`, 200, 140),
      ),
      "control-voice": arm(
        { solver: "neutral", renderer: "voice", taskModeId: null },
        structuredClone(controlSolver),
        rendererStage(`${definition.id}:control-renderer`, 160, controlSolver.artifactSha256),
        91,
      ),
      "task-voice": taskVoice,
    },
  };
}

function fixture(runKind = "confirmatory") {
  return {
    schemaVersion: 2,
    id: "synthetic-layer-test",
    runKind,
    commit: "0123456789abcdef0123456789abcdef01234567",
    persona: {
      id: "detective",
      version: "2.0.0",
      manifestSchemaVersion: "2.0.0",
      locale: "en",
      intensity: "balanced",
      taskModeId: "detective-root-cause",
    },
    runtime: {
      surface: "synthetic",
      model: "synthetic-model",
      modelSettingsSha256: MODEL_SETTINGS.sha256,
      toolPolicySha256: SOLVER_TOOL_POLICY.sha256,
      rendererPolicySha256: RENDERER_POLICY_SHA256,
      rendererToolPolicySha256: RENDERER_TOOL_POLICY_SHA256,
      timingMode: "counterbalanced-sequential",
      seed: 42,
      armOrder: [
        "control",
        "length-matched-neutral",
        "legacy-global",
        "control-voice",
        "task-voice",
      ],
    },
    protocol: {
      protocolArtifactSha256: PERSONA_LAYER_PROTOCOL_SHA256,
      compatibilityMatrixSha256: PERSONA_TASK_COMPATIBILITY_MATRIX_SHA256,
      workloadCatalogSha256: PERSONA_LAYER_WORKLOAD_CATALOG_SHA256,
      lengthMatching: {
        method: "deterministic neutral prose matched by whitespace word count",
        targetArm: "legacy-global",
        toleranceWords: 0,
        planSha256: "d".repeat(64),
      },
      nonInferiorityMargin: 3,
      taskQualityMinimumDelta: 1,
      confidence: {
        ...PERSONA_LAYER_BOOTSTRAP_CONTRACT,
        minimumWorkloadPairs: 8,
        minimumCompatibleTaskPairs: 4,
        minimumRatersPerWorkload: 8,
        minimumTotalRaters: 64,
        samplePlanSha256: PERSONA_LAYER_SAMPLE_PLAN_SHA256,
      },
      judge: {
        identity: "synthetic-shared-judge",
        version: "1.0.0",
        configurationSha256: JUDGE_CONFIGURATION.sha256,
        rubricSha256: JUDGE_RUBRIC.sha256,
        seed: 7,
        judgePayloadSha256: JUDGE_PAYLOAD_SHA256,
        evaluatorEvidenceSha256: "6".repeat(64),
      },
      tokenBudgetRatio: 1.25,
      timeBudgetRatio: 1.25,
      taskTokenBudgetRatio: 1.1,
      taskTimeBudgetRatio: 1.1,
      criticalSafetyThreshold: 0,
      ux: {
        humanRated: true,
        armLabelsBlinded: true,
        presentationRandomized: true,
        randomizationMappingSha256: "3".repeat(64),
        raterAttestationSha256: "4".repeat(64),
        dimensions: [
          "pairwise-preference",
          "persona-identification",
          "clarity",
          "trust",
          "perceived-effort",
          "intent-to-reuse",
        ],
        preferenceScoreMinimum: 0.6,
        voiceRecognitionRateMinimum: 0.6,
        voiceRecognitionLiftMinimum: 0.3,
        secondaryNonInferiorityMargin: 0.5,
      },
    },
    workloads: FIXTURES.map(workload),
    ux: FIXTURES.map(({ id: workloadId }) => ({
      workloadId,
      raters: 8,
      preference: { control: 1, voice: 5, tie: 2 },
      personaIdentification: {
        control: { correct: 0, incorrect: 7, unsure: 1 },
        voice: { correct: 8, incorrect: 0, unsure: 0 },
      },
      clarity: { control: 5.8, voice: 6.2 },
      trust: { control: 5.9, voice: 6.0 },
      perceivedEffort: { control: 3.1, voice: 2.8 },
      intentToReuse: { control: 5.4, voice: 6.1 },
    })),
  };
}

function privateEvidenceFor(result) {
  const stageEvidence = (stage, toolPolicySha256) => ({
    prompt: { sha256: stage.promptSha256, base64: PAYLOAD_BY_SHA256.get(stage.promptSha256) },
    artifact: {
      sha256: stage.artifactSha256,
      base64: PAYLOAD_BY_SHA256.get(stage.artifactSha256),
    },
    modelSettingsSha256: result.runtime.modelSettingsSha256,
    toolPolicySha256,
  });
  const randomizationMappingContents = Buffer.from(
    JSON.stringify({
      schemaVersion: "1.0.0",
      resultId: result.id,
      commit: result.commit,
      workloads: result.workloads.map((workload, index) => ({
        workloadId: workload.id,
        assignments: [
          {
            opaqueId: `opaque_${String(index).padStart(2, "0")}_a`,
            position: index % 2 === 0 ? "first" : "second",
            armId: "control",
            artifactSha256: workload.arms.control.solver.artifactSha256,
          },
          {
            opaqueId: `opaque_${String(index).padStart(2, "0")}_b`,
            position: index % 2 === 0 ? "second" : "first",
            armId: "control-voice",
            artifactSha256: workload.arms["control-voice"].renderer.artifactSha256,
          },
        ],
      })),
    }),
  );
  result.protocol.ux.randomizationMappingSha256 = createHash("sha256")
    .update(randomizationMappingContents)
    .digest("hex");
  const evaluatorEvidenceContents = Buffer.from(
    JSON.stringify({
      schemaVersion: "1.0.0",
      resultId: result.id,
      commit: result.commit,
      evaluatorIdentity: result.protocol.judge.identity,
      evaluatorVersion: result.protocol.judge.version,
      judgeSeed: result.protocol.judge.seed,
      completedAt: "2026-07-15T00:00:00.000Z",
      payloads: {
        modelSettings: MODEL_SETTINGS,
        solverToolPolicy: SOLVER_TOOL_POLICY,
        rendererToolPolicy: RENDERER_TOOL_POLICY,
        judgeConfiguration: JUDGE_CONFIGURATION,
        judgeRubric: JUDGE_RUBRIC,
        judgePayload: JUDGE_PAYLOAD,
      },
      workloads: result.workloads.map((workload) => ({
        workloadId: workload.id,
        arms: Object.fromEntries(
          Object.entries(workload.arms).map(([armId, arm]) => [
            armId,
            {
              solver: stageEvidence(arm.solver, result.runtime.toolPolicySha256),
              renderer:
                arm.renderer === null
                  ? null
                  : stageEvidence(arm.renderer, result.runtime.rendererToolPolicySha256),
              taskQuality: arm.taskQuality === null ? null : { ...arm.taskQuality },
              safety: structuredClone(arm.safety),
            },
          ]),
        ),
      })),
    }),
  );
  result.protocol.judge.evaluatorEvidenceSha256 = createHash("sha256")
    .update(evaluatorEvidenceContents)
    .digest("hex");
  const raterAttestationContents = Buffer.from(
    JSON.stringify({
      schemaVersion: "1.0.0",
      resultId: result.id,
      commit: result.commit,
      randomizationMappingSha256: result.protocol.ux.randomizationMappingSha256,
      aggregateUxSha256: personaLayerAggregateUxSha256(result.ux),
      evaluatorEvidenceSha256: result.protocol.judge.evaluatorEvidenceSha256,
      collectorIdentity: "synthetic-human-ux-collector",
      collectorVersion: "1.0.0",
      completedAt: "2026-07-15T00:00:00.000Z",
      attestations: {
        humanRating: true,
        blinding: true,
        consent: true,
        eligibility: true,
        pseudonymousRaterUniqueness: true,
      },
    }),
  );
  result.protocol.ux.raterAttestationSha256 = createHash("sha256")
    .update(raterAttestationContents)
    .digest("hex");
  return {
    expectedCommit: result.commit,
    randomizationMappingContents,
    raterAttestationContents,
    evaluatorEvidenceContents,
  };
}

function summarizeVerified(result) {
  return summarizePersonaLayerBenchmarkResult(result, privateEvidenceFor(result));
}

test("passes only a sufficiently sampled confirmatory result using deterministic bounds", () => {
  const result = fixture();
  assert.doesNotThrow(() => validatePersonaLayerBenchmarkResult(result));
  const first = summarizeVerified(result);
  const second = summarizePersonaLayerBenchmarkResult(result, privateEvidenceFor(result));
  assert.equal(first.releaseGate, "pass");
  assert.equal(first.criticalSafetyFailureCount, 0);
  assert.equal(first.evidenceGuardrails.sufficient, true);
  assert.deepEqual(first.confidence, second.confidence);
  assert.equal(first.confidence.bounds.voicePreferenceScore.lowerBound, 0.75);
  assert.equal(first.confidence.bounds.voiceRecognitionRate.lowerBound, 0.747276);
  assert.equal(first.confidence.bounds.voiceRecognitionLift.lowerBound, 0.351185);
  assert.equal(
    first.confidence.bounds.voiceRecognitionRate.workloadBootstrapLowerBound,
    1,
  );
  assert.equal(
    first.confidence.bounds.voiceRecognitionLift.workloadBootstrapLowerBound,
    1,
  );
  assert.equal(first.decisionChecks.voiceRecognitionRate, true);
  assert.equal(first.decisionChecks.voiceRecognitionLift, true);
  assert.equal(first.decisionChecks.taskQualityMinimumDeltaVsControlVoice, true);
  const markdown = renderPersonaLayerBenchmarkMarkdown(result, first);
  assert.match(markdown, /Voice recognition estimate/u);
  assert.match(markdown, /Voice recognition lift over control/u);
  assert.match(markdown, /Renderer policy expected from checkout/u);
  assert.match(markdown, new RegExp(RENDERER_POLICY_SHA256, "u"));
  assert.doesNotMatch(markdown, /correct|incorrect|unsure/u);
  assert.equal("ux" in first, false);
  assert.equal("uxWorkloadRows" in first, false);
});

test("requires exact-commit, hash-verified private evidence for confirmatory PASS", () => {
  const result = fixture();
  assert.equal(summarizePersonaLayerBenchmarkResult(result).releaseGate, "inconclusive");

  const evidence = privateEvidenceFor(result);
  assert.equal(
    summarizePersonaLayerBenchmarkResult(result, {
      ...evidence,
      expectedCommit: "f".repeat(40),
    }).releaseGate,
    "fail",
  );
  assert.equal(
    summarizePersonaLayerBenchmarkResult(result, {
      ...evidence,
      randomizationMappingContents: Buffer.from("tampered"),
    }).releaseGate,
    "fail",
  );

  const malformedAttestation = Buffer.from(
    JSON.stringify({ extra: true }),
  );
  result.protocol.ux.raterAttestationSha256 = createHash("sha256")
    .update(malformedAttestation)
    .digest("hex");
  assert.equal(
    summarizePersonaLayerBenchmarkResult(result, {
      ...evidence,
      raterAttestationContents: malformedAttestation,
    }).releaseGate,
    "fail",
  );
});

test("rejects trivial mappings, missing human assurances, and evaluator-payload tampering", () => {
  const trivialMappingResult = fixture();
  const trivialEvidence = privateEvidenceFor(trivialMappingResult);
  const trivialMappingContents = Buffer.from(
    JSON.stringify({ schemaVersion: "1.0.0", assignments: ["B", "A"] }),
  );
  trivialMappingResult.protocol.ux.randomizationMappingSha256 = createHash("sha256")
    .update(trivialMappingContents)
    .digest("hex");
  const trivialSummary = summarizePersonaLayerBenchmarkResult(trivialMappingResult, {
    ...trivialEvidence,
    randomizationMappingContents: trivialMappingContents,
  });
  assert.equal(trivialSummary.provenance.randomizationMapping.status, "invalid");
  assert.equal(trivialSummary.releaseGate, "fail");

  const falseAssuranceResult = fixture();
  const falseAssuranceEvidence = privateEvidenceFor(falseAssuranceResult);
  const falseAssurance = JSON.parse(falseAssuranceEvidence.raterAttestationContents);
  falseAssurance.attestations.consent = false;
  const falseAssuranceContents = Buffer.from(JSON.stringify(falseAssurance));
  falseAssuranceResult.protocol.ux.raterAttestationSha256 = createHash("sha256")
    .update(falseAssuranceContents)
    .digest("hex");
  const falseAssuranceSummary = summarizePersonaLayerBenchmarkResult(falseAssuranceResult, {
    ...falseAssuranceEvidence,
    raterAttestationContents: falseAssuranceContents,
  });
  assert.equal(falseAssuranceSummary.provenance.raterAttestation.status, "invalid");
  assert.equal(falseAssuranceSummary.releaseGate, "fail");

  const evaluatorTamperResult = fixture();
  const evaluatorTamperEvidence = privateEvidenceFor(evaluatorTamperResult);
  const evaluatorTamper = JSON.parse(evaluatorTamperEvidence.evaluatorEvidenceContents);
  evaluatorTamper.workloads[0].arms.control.solver.prompt.base64 = Buffer.from(
    "tampered prompt",
  ).toString("base64");
  const evaluatorTamperContents = Buffer.from(JSON.stringify(evaluatorTamper));
  evaluatorTamperResult.protocol.judge.evaluatorEvidenceSha256 = createHash("sha256")
    .update(evaluatorTamperContents)
    .digest("hex");
  const evaluatorTamperSummary = summarizePersonaLayerBenchmarkResult(evaluatorTamperResult, {
    ...evaluatorTamperEvidence,
    evaluatorEvidenceContents: evaluatorTamperContents,
  });
  assert.equal(evaluatorTamperSummary.provenance.evaluatorEvidence.status, "invalid");
  assert.equal(evaluatorTamperSummary.releaseGate, "fail");
});

test("reconstructs every Voice renderer request from the exact solver artifact", () => {
  const canonicalResult = fixture();
  const canonicalSummary = summarizePersonaLayerBenchmarkResult(
    canonicalResult,
    privateEvidenceFor(canonicalResult),
  );
  assert.equal(canonicalSummary.provenance.evaluatorEvidence.status, "verified");
  assert.equal(canonicalSummary.releaseGate, "pass");

  const arbitraryResult = fixture();
  const renderer = arbitraryResult.workloads[0].arms["control-voice"].renderer;
  const arbitraryContents = Buffer.from(
    `${JSON.stringify([{ role: "system", content: "self-consistent but noncanonical" }])}\n`,
    "utf8",
  );
  const arbitraryPrompt = evidencePayload("arbitrary-renderer-request", arbitraryContents);
  renderer.promptSha256 = arbitraryPrompt.sha256;
  renderer.promptBytes = arbitraryContents.length;
  renderer.promptWords = whitespaceWordCount(arbitraryContents);
  const arbitrarySummary = summarizePersonaLayerBenchmarkResult(
    arbitraryResult,
    privateEvidenceFor(arbitraryResult),
  );
  assert.equal(arbitrarySummary.provenance.evaluatorEvidence.status, "invalid");
  assert.equal(arbitrarySummary.releaseGate, "fail");
});

test("content-addresses the core message builder and canonical request encoder", async () => {
  const policy = derivePersonaRendererPolicy(BENCHMARK_PERSONA);
  assert.equal(
    policy.hostTemplate.sourceContract,
    "packages/core/src/compiler.ts#wordCount+nonEmptyParagraphCount+voiceRuntimeControl+voiceMessages",
  );
  assert.equal(
    policy.hostTemplate.sha256,
    createHash("sha256").update(canonicalCompilerRendererSourceForTest()).digest("hex"),
  );
  assert.equal(policy.requestEncoding.version, PERSONA_RENDERER_REQUEST_ENCODING_VERSION);
  assert.equal(policy.requestEncoding.personasSource, PERSONA_RENDERER_PERSONAS_SOURCE);
  assert.equal(policy.requestEncoding.personasSource, "../personas/");
  assert.match(policy.requestEncoding.encoderSha256, /^[a-f0-9]{64}$/u);

  const temporaryModulePath = join(
    dirname(scriptPath),
    `.persona-layer-benchmark-report.encoder-tamper-${process.pid}.mjs`,
  );
  const originalSource = readFileSync(scriptPath, "utf8");
  const originalEncoderLine =
    'return Buffer.from(`${JSON.stringify(messages)}\\n`, "utf8");';
  const tamperedEncoderLine =
    'return Buffer.from(`${JSON.stringify(messages)}\\n\\n`, "utf8");';
  assert.ok(originalSource.includes(originalEncoderLine));
  try {
    writeFileSync(
      temporaryModulePath,
      originalSource.replace(originalEncoderLine, tamperedEncoderLine),
    );
    const tamperedModule = await import(
      `${pathToFileURL(temporaryModulePath).href}?tamper=${Date.now()}`
    );
    const tamperedPolicy = tamperedModule.derivePersonaRendererPolicy(BENCHMARK_PERSONA);
    assert.notEqual(tamperedPolicy.requestEncoding.encoderSha256, policy.requestEncoding.encoderSha256);
    assert.notEqual(tamperedPolicy.sha256, policy.sha256);
  } finally {
    rmSync(temporaryModulePath, { force: true });
  }
});

test("derives prompt byte and whitespace-word counts from private prompt bytes", () => {
  for (const field of ["promptBytes", "promptWords"]) {
    const result = fixture();
    result.workloads[0].arms["task-voice"].solver[field] += 1;
    const summary = summarizePersonaLayerBenchmarkResult(result, privateEvidenceFor(result));
    assert.equal(summary.provenance.evaluatorEvidence.status, "invalid", field);
    assert.equal(summary.releaseGate, "fail", field);
  }
});

test("rejects a Voice input artifact that is not lossless UTF-8", () => {
  const result = fixture();
  const arm = result.workloads[0].arms["task-voice"];
  const invalidUtf8 = evidencePayload("invalid-utf8-solver-artifact", Buffer.from([0xc3, 0x28]));
  arm.solver.artifactSha256 = invalidUtf8.sha256;
  arm.renderer.inputArtifactSha256 = invalidUtf8.sha256;
  const summary = summarizePersonaLayerBenchmarkResult(result, privateEvidenceFor(result));
  assert.equal(summary.provenance.evaluatorEvidence.status, "invalid");
  assert.equal(summary.releaseGate, "fail");
});

test("derives the renderer policy from checkout assets instead of trusting the result", () => {
  const result = fixture();
  const arbitrary = "c".repeat(64);
  result.runtime.rendererPolicySha256 = arbitrary;
  for (const workload of result.workloads) {
    workload.arms["control-voice"].renderer.rendererPolicySha256 = arbitrary;
    workload.arms["task-voice"].renderer.rendererPolicySha256 = arbitrary;
  }
  const summary = summarizePersonaLayerBenchmarkResult(result, privateEvidenceFor(result));
  assert.equal(summary.provenance.rendererPolicy.status, "mismatch");
  assert.equal(summary.provenance.rendererPolicy.actualSha256, arbitrary);
  assert.equal(summary.provenance.rendererPolicy.expectedSha256, RENDERER_POLICY_SHA256);
  assert.equal(summary.releaseGate, "fail");
});

test("finite-rater recognition bounds can fail a degenerate workload bootstrap", () => {
  const rate = fixture();
  for (const ux of rate.ux) {
    ux.personaIdentification.control = { correct: 0, incorrect: 7, unsure: 1 };
    ux.personaIdentification.voice = { correct: 5, incorrect: 2, unsure: 1 };
  }
  const rateSummary = summarizePersonaLayerBenchmarkResult(rate);
  assert.equal(
    rateSummary.confidence.bounds.voiceRecognitionRate.workloadBootstrapLowerBound,
    0.625,
  );
  assert.ok(rateSummary.confidence.bounds.voiceRecognitionRate.lowerBound < 0.6);
  assert.equal(rateSummary.decisionChecks.voiceRecognitionRate, false);

  const lift = fixture();
  for (const ux of lift.ux) {
    ux.personaIdentification.control = { correct: 4, incorrect: 3, unsure: 1 };
    ux.personaIdentification.voice = { correct: 7, incorrect: 1, unsure: 0 };
  }
  const liftSummary = summarizePersonaLayerBenchmarkResult(lift);
  assert.equal(
    liftSummary.confidence.bounds.voiceRecognitionLift.workloadBootstrapLowerBound,
    0.375,
  );
  assert.ok(liftSummary.confidence.bounds.voiceRecognitionLift.lowerBound < 0.3);
  assert.equal(liftSummary.decisionChecks.voiceRecognitionLift, false);
});

test("uses the weakest per-workload Wilson/Newcombe bound instead of pooling ratings", () => {
  const result = fixture();
  result.ux[0].personaIdentification.voice = { correct: 5, incorrect: 2, unsure: 1 };
  const summary = summarizePersonaLayerBenchmarkResult(result);
  assert.equal(
    summary.confidence.bounds.voiceRecognitionRate.lowerBoundMethod,
    "minimum-of-workload-bootstrap-and-per-workload-one-sided-wilson",
  );
  assert.equal(
    summary.confidence.bounds.voiceRecognitionLift.lowerBoundMethod,
    "minimum-of-workload-bootstrap-and-per-workload-newcombe-wilson",
  );
  assert.ok(summary.confidence.bounds.voiceRecognitionRate.minimumWorkloadWilsonLowerBound < 0.6);
  assert.equal(summary.decisionChecks.voiceRecognitionRate, false);
  assert.equal(summary.releaseGate, "fail");
});

test("fails favorable Voice preference when blind persona recognition is insufficient", () => {
  const result = fixture();
  for (const ux of result.ux) {
    ux.personaIdentification.voice = { correct: 4, incorrect: 3, unsure: 1 };
  }
  const summary = summarizePersonaLayerBenchmarkResult(result);
  assert.equal(summary.decisionChecks.voicePreference, true);
  assert.equal(summary.decisionChecks.voiceRecognitionRate, false);
  assert.equal(summary.releaseGate, "fail");
});

test("fails recognition lift when control and Voice are equally recognizable", () => {
  const result = fixture();
  for (const ux of result.ux) {
    ux.personaIdentification.control = { correct: 8, incorrect: 0, unsure: 0 };
    ux.personaIdentification.voice = { correct: 8, incorrect: 0, unsure: 0 };
  }
  const summary = summarizePersonaLayerBenchmarkResult(result);
  assert.equal(summary.decisionChecks.voiceRecognitionRate, true);
  assert.equal(summary.decisionChecks.voiceRecognitionLift, false);
  assert.equal(summary.releaseGate, "fail");
});

test("rejects persona-identification counts that do not sum to raters", () => {
  const result = fixture();
  result.ux[0].personaIdentification.voice.unsure = 1;
  assert.equal(validateResultSchema(result), true, JSON.stringify(validateResultSchema.errors));
  assert.throws(
    () => validatePersonaLayerBenchmarkResult(result),
    /personaIdentification\.voice must sum to raters/u,
  );
});

test("uses unrounded confidence bounds for release decisions", () => {
  const result = fixture();
  for (const item of result.workloads) {
    for (const armId of ["control", "control-voice"]) {
      item.arms[armId].solver.tokens = {
        input: 2_499_980,
        cachedInput: 0,
        reasoning: 0,
        output: 20,
      };
    }
    item.arms["control-voice"].renderer.tokens = {
      input: 624_981,
      cachedInput: 0,
      reasoning: 0,
      output: 20,
    };
  }
  const summary = summarizePersonaLayerBenchmarkResult(result);
  assert.equal(summary.confidence.bounds.voiceTokenRatio.upperBound, 1.25);
  assert.equal(summary.decisionChecks.voiceTokenBudget, false);
  assert.equal(summary.releaseGate, "fail");
});

test("keeps non-confirmatory success inconclusive while real failures still fail", () => {
  for (const runKind of ["protocol-validation", "pilot", "screening"]) {
    assert.equal(summarizePersonaLayerBenchmarkResult(fixture(runKind)).releaseGate, "inconclusive");
  }
  const failedPilot = fixture("pilot");
  failedPilot.workloads[0].arms["task-voice"].taskQuality.score = 90;
  assert.equal(summarizePersonaLayerBenchmarkResult(failedPilot).releaseGate, "fail");
});

test("keeps critical safety evidence structurally valid and fails every run kind", () => {
  const result = fixture("protocol-validation");
  result.workloads[0].arms["control-voice"].safety.criticalFailures.push({
    id: "mutated-refusal",
    description: "The renderer removed a refusal boundary.",
  });
  const summary = summarizePersonaLayerBenchmarkResult(result);
  assert.deepEqual(summary.criticalSafetyFailures[0], {
    workloadId: "aligned-a",
    armId: "control-voice",
    id: "mutated-refusal",
    description: "The renderer removed a refusal boundary.",
  });
  assert.equal(summary.releaseGate, "fail");
});

test("attests exact renderer input linkage and tool-disabled runtime policy", () => {
  const wrongInput = fixture();
  wrongInput.workloads[0].arms["control-voice"].renderer.inputArtifactSha256 = "0".repeat(64);
  assert.throws(() => validatePersonaLayerBenchmarkResult(wrongInput), /must equal its arm solver artifact/);

  const toolsEnabled = fixture();
  toolsEnabled.workloads[0].arms["task-voice"].renderer.toolsEnabled = true;
  assert.equal(validateResultSchema(toolsEnabled), false);
  assert.throws(() => validatePersonaLayerBenchmarkResult(toolsEnabled), /toolsEnabled must be false/);

  const wrongPolicy = fixture();
  wrongPolicy.workloads[0].arms["control-voice"].renderer.rendererPolicySha256 = "0".repeat(64);
  assert.throws(() => validatePersonaLayerBenchmarkResult(wrongPolicy), /runtime renderer policy/);

  const wrongToolPolicy = fixture();
  wrongToolPolicy.workloads[0].arms["control-voice"].renderer.toolPolicySha256 = "0".repeat(64);
  assert.throws(() => validatePersonaLayerBenchmarkResult(wrongToolPolicy), /runtime renderer tool policy/);
});

test("isolates Task value against control-voice rather than raw control", () => {
  const summary = summarizePersonaLayerBenchmarkResult(fixture());
  const comparison = summary.comparisons[0];
  assert.equal(comparison.taskVsControlVoiceTokenRatio, 1.068966);
  assert.equal(comparison.fullProductTokenRatioVsControl, 1.291667);
  assert.equal(comparison.taskQualityDeltaVsControlVoice, 1);
  assert.equal(comparison.fullProductQualityDeltaVsControl, 2);

  const oldComparatorWouldPass = fixture();
  for (const item of oldComparatorWouldPass.workloads.filter(
    (candidate) => candidate.taskModeCompatible,
  )) {
    item.arms["task-voice"].taskQuality.score = 91;
  }
  const oldComparatorSummary = summarizePersonaLayerBenchmarkResult(oldComparatorWouldPass);
  assert.equal(oldComparatorSummary.comparisons[0].fullProductQualityDeltaVsControl, 1);
  assert.equal(oldComparatorSummary.comparisons[0].taskQualityDeltaVsControlVoice, 0);
  assert.equal(oldComparatorSummary.releaseGate, "fail");
});

test("makes insufficient confirmatory evidence inconclusive and rejects duplicate fixtures", () => {
  const tooSmall = fixture();
  tooSmall.workloads = tooSmall.workloads.slice(0, 6);
  tooSmall.ux = tooSmall.ux.slice(0, 6);
  const tooSmallSummary = summarizePersonaLayerBenchmarkResult(tooSmall);
  assert.equal(tooSmallSummary.evidenceGuardrails.sufficient, false);
  assert.equal(tooSmallSummary.releaseGate, "inconclusive");

  const duplicate = fixture();
  duplicate.workloads[7].fixtureId = duplicate.workloads[6].fixtureId;
  duplicate.workloads[7].fixtureSha256 = duplicate.workloads[6].fixtureSha256;
  duplicate.workloads[7].family = duplicate.workloads[6].family;
  duplicate.workloads[7].alignment = duplicate.workloads[6].alignment;
  duplicate.workloads[7].taskModeCompatible = duplicate.workloads[6].taskModeCompatible;
  assert.throws(
    () => summarizePersonaLayerBenchmarkResult(duplicate),
    /fixtureId must be unique across independent workload pairs/,
  );

  const duplicatedFavorableRow = fixture();
  const extraWorkload = structuredClone(duplicatedFavorableRow.workloads[0]);
  extraWorkload.id = "aligned-a-duplicate";
  extraWorkload.arms["control-voice"].taskQuality.score = 100;
  duplicatedFavorableRow.workloads.push(extraWorkload);
  duplicatedFavorableRow.ux.push({
    ...structuredClone(duplicatedFavorableRow.ux[0]),
    workloadId: extraWorkload.id,
    preference: { control: 0, voice: 8, tie: 0 },
  });
  assert.throws(
    () => summarizePersonaLayerBenchmarkResult(duplicatedFavorableRow),
    /fixtureId must be unique across independent workload pairs/,
  );
});

test("rejects mixed task-quality scales across workloads", () => {
  const mixedScale = fixture();
  for (const arm of Object.values(mixedScale.workloads[0].arms)) {
    if (arm.taskQuality !== null) {
      arm.taskQuality.score /= 100;
      arm.taskQuality.maximum = 1;
    }
  }
  assert.throws(
    () => summarizePersonaLayerBenchmarkResult(mixedScale),
    /taskQuality.maximum must match the preregistered quality scale/,
  );
});

test("treats missing cost or quality evidence as inconclusive", () => {
  const missingTokens = fixture();
  missingTokens.workloads[0].arms["control-voice"].renderer.tokens.output = null;
  assert.equal(summarizePersonaLayerBenchmarkResult(missingTokens).releaseGate, "inconclusive");

  const missingQuality = fixture();
  missingQuality.workloads[0].arms["task-voice"].taskQuality = null;
  assert.equal(summarizePersonaLayerBenchmarkResult(missingQuality).releaseGate, "inconclusive");
});

test("binds tracked protocol, sample plan, workload, judge, and human attestations", () => {
  const wrongProtocol = fixture();
  wrongProtocol.protocol.protocolArtifactSha256 = "0".repeat(64);
  assert.throws(() => validatePersonaLayerBenchmarkResult(wrongProtocol), /tracked protocol-v2/);

  const wrongPower = fixture();
  wrongPower.protocol.confidence.samplePlanSha256 = "0".repeat(64);
  assert.throws(() => validatePersonaLayerBenchmarkResult(wrongPower), /tracked sample-plan-v2/);

  const wrongFixture = fixture();
  wrongFixture.workloads[0].fixtureSha256 = "0".repeat(64);
  assert.throws(() => validatePersonaLayerBenchmarkResult(wrongFixture), /tracked workload fixture/);

  const wrongPersonaVersion = fixture();
  wrongPersonaVersion.persona.version = "9.9.9";
  assert.throws(
    () => validatePersonaLayerBenchmarkResult(wrongPersonaVersion),
    /version must match its canonical v2 persona manifest/,
  );

  const mixedJudge = fixture();
  mixedJudge.workloads[0].arms.control.taskQuality.judgePayloadSha256 = "0".repeat(64);
  assert.throws(() => validatePersonaLayerBenchmarkResult(mixedJudge), /preregistered judge payload/);

  const missingRaterAttestation = fixture();
  delete missingRaterAttestation.protocol.ux.raterAttestationSha256;
  assert.equal(validateResultSchema(missingRaterAttestation), false);
  assert.throws(() => validatePersonaLayerBenchmarkResult(missingRaterAttestation), /must contain exactly/);
});

test("cross-validates the complete compatibility matrix against canonical v2 manifests", () => {
  assert.equal(validatePersonaTaskCompatibilityCatalog(), true);

  const missingModeCatalog = structuredClone(PERSONA_TASK_MODE_CATALOG);
  missingModeCatalog.find((persona) => persona.id === "detective").taskModeIds.pop();
  assert.throws(
    () => validatePersonaTaskCompatibilityCatalog(PERSONA_TASK_COMPATIBILITY_MATRIX, missingModeCatalog),
    /must exactly match its canonical v2 manifest/,
  );

  const unknownPersonaMatrix = structuredClone(PERSONA_TASK_COMPATIBILITY_MATRIX);
  unknownPersonaMatrix.personas.push({ id: "unknown", modes: [] });
  assert.throws(
    () => validatePersonaTaskCompatibilityCatalog(unknownPersonaMatrix),
    /persona IDs must exactly match canonical v2 persona manifests/,
  );
});

test("keeps JSON Schema and executable validation aligned under mutations", () => {
  const valid = fixture();
  assert.equal(validateResultSchema(valid), true, JSON.stringify(validateResultSchema.errors));

  const looseVersion = fixture();
  looseVersion.persona.version = "01.0.0";
  assert.equal(validateResultSchema(looseVersion), false);
  assert.throws(() => validatePersonaLayerBenchmarkResult(looseVersion), /semantic version/);

  const badBootstrap = fixture();
  badBootstrap.protocol.confidence.samples = 9999;
  assert.equal(validateResultSchema(badBootstrap), false);
  assert.throws(() => validatePersonaLayerBenchmarkResult(badBootstrap), /fixed v2/);

  const excessiveTolerance = fixture();
  excessiveTolerance.protocol.lengthMatching.toleranceWords = 11;
  assert.equal(validateResultSchema(excessiveTolerance), false);
  assert.throws(() => validatePersonaLayerBenchmarkResult(excessiveTolerance), /must be <= 10/);

  const mismatchedScale = fixture();
  mismatchedScale.workloads[0].arms["control-voice"].taskQuality.maximum = 95;
  assert.throws(
    () => validatePersonaLayerBenchmarkResult(mismatchedScale),
    /must match the preregistered quality scale/,
  );

  const relaxedCostThreshold = fixture();
  relaxedCostThreshold.protocol.tokenBudgetRatio = 10;
  assert.equal(validateResultSchema(relaxedCostThreshold), false);
  assert.throws(
    () => validatePersonaLayerBenchmarkResult(relaxedCostThreshold),
    /tokenBudgetRatio must match tracked sample-plan-v2/,
  );

  const relaxedQualityThreshold = fixture();
  relaxedQualityThreshold.protocol.taskQualityMinimumDelta = 0.01;
  assert.equal(validateResultSchema(relaxedQualityThreshold), false);
  assert.throws(
    () => validatePersonaLayerBenchmarkResult(relaxedQualityThreshold),
    /taskQualityMinimumDelta must match tracked sample-plan-v2/,
  );

  const relaxedUxThreshold = fixture();
  relaxedUxThreshold.protocol.ux.preferenceScoreMinimum = 0.51;
  assert.equal(validateResultSchema(relaxedUxThreshold), false);
  assert.throws(
    () => validatePersonaLayerBenchmarkResult(relaxedUxThreshold),
    /preferenceScoreMinimum must match tracked sample-plan-v2/,
  );

  const neutralPreferenceThreshold = fixture();
  neutralPreferenceThreshold.protocol.ux.preferenceScoreMinimum = 0.5;
  assert.equal(validateResultSchema(neutralPreferenceThreshold), false);
  assert.throws(() => validatePersonaLayerBenchmarkResult(neutralPreferenceThreshold), /must be > 0\.5/);
});

test("keeps the tracked v2 example synthetic, valid, and non-release", () => {
  const example = JSON.parse(
    readFileSync(
      new URL("../benchmarks/persona-overhead/result-v2.example.json", import.meta.url),
      "utf8",
    ),
  );
  assert.match(example.id, /^synthetic-/u);
  assert.equal(example.runKind, "protocol-validation");
  assert.equal(validateResultSchema(example), true, JSON.stringify(validateResultSchema.errors));
  assert.doesNotThrow(() => validatePersonaLayerBenchmarkResult(example));
  const summary = summarizePersonaLayerBenchmarkResult(example);
  assert.equal(summary.evidenceGuardrails.sufficient, false);
  assert.equal(summary.releaseGate, "inconclusive");
});

test("parses options and makes --gate exit zero only for confirmatory PASS", () => {
  assert.deepEqual(parsePersonaLayerBenchmarkCliArgs(["--json", "result.json"], {}), {
    json: true,
    gate: false,
    help: false,
    requestedPath: "result.json",
    expectedCommit: null,
    randomizationMappingPath: null,
    raterAttestationPath: null,
    evaluatorEvidencePath: null,
  });
  assert.equal(
    parsePersonaLayerBenchmarkCliArgs(["result.json"], {
      GITHUB_SHA: "a".repeat(40),
    }).expectedCommit,
    "a".repeat(40),
  );
  assert.throws(() => parsePersonaLayerBenchmarkCliArgs(["--wat"], {}), /Unknown option/);
  assert.throws(
    () => parsePersonaLayerBenchmarkCliArgs(["result.json", "--gate"], {}),
    /requires an exact expected commit/u,
  );

  const directory = mkdtempSync(join(tmpdir(), "persona-layer-gate-"));
  try {
    const confirmatoryPath = join(directory, "confirmatory.json");
    const pilotPath = join(directory, "pilot.json");
    const randomizationPath = join(directory, "randomization.json");
    const raterAttestationPath = join(directory, "rater-attestation.json");
    const evaluatorEvidencePath = join(directory, "evaluator-evidence.json");
    const confirmatory = fixture("confirmatory");
    const confirmatoryEvidence = privateEvidenceFor(confirmatory);
    const pilot = fixture("pilot");
    privateEvidenceFor(pilot);
    writeFileSync(confirmatoryPath, JSON.stringify(confirmatory));
    writeFileSync(pilotPath, JSON.stringify(pilot));
    writeFileSync(randomizationPath, confirmatoryEvidence.randomizationMappingContents);
    writeFileSync(raterAttestationPath, confirmatoryEvidence.raterAttestationContents);
    writeFileSync(evaluatorEvidencePath, confirmatoryEvidence.evaluatorEvidenceContents);
    const evidenceArguments = [
      "--expected-commit",
      confirmatory.commit,
      "--randomization-mapping",
      randomizationPath,
      "--rater-attestation",
      raterAttestationPath,
      "--evaluator-evidence",
      evaluatorEvidencePath,
    ];
    const passing = spawnSync(process.execPath, [
      scriptPath,
      confirmatoryPath,
      "--json",
      "--gate",
      ...evidenceArguments,
    ], {
      encoding: "utf8",
    });
    const inconclusive = spawnSync(process.execPath, [
      scriptPath,
      pilotPath,
      "--json",
      "--gate",
      ...evidenceArguments,
    ], {
      encoding: "utf8",
    });
    assert.equal(passing.status, 0, passing.stderr);
    assert.equal(inconclusive.status, 1, inconclusive.stderr);
    const jsonSummary = JSON.parse(inconclusive.stdout);
    assert.equal(jsonSummary.releaseGate, "inconclusive");
    assert.equal("ux" in jsonSummary, false);
    assert.equal("uxWorkloadRows" in jsonSummary, false);

    const stale = spawnSync(process.execPath, [
      scriptPath,
      confirmatoryPath,
      "--json",
      "--gate",
      ...evidenceArguments.with(1, "f".repeat(40)),
    ], { encoding: "utf8" });
    assert.equal(stale.status, 1);
    assert.equal(JSON.parse(stale.stdout).releaseGate, "fail");

    const publicAttestationPath = join(directory, "public-attestation.json");
    const writer = spawnSync(process.execPath, [writeAttestationScriptPath], {
      encoding: "utf8",
      env: {
        ...process.env,
        PERSONA_BENCHMARK_RESULT_PATH: confirmatoryPath,
        PERSONA_BENCHMARK_RANDOMIZATION_MAPPING_PATH: randomizationPath,
        PERSONA_BENCHMARK_RATER_ATTESTATION_PATH: raterAttestationPath,
        PERSONA_BENCHMARK_EVALUATOR_EVIDENCE_PATH: evaluatorEvidencePath,
        PERSONA_BENCHMARK_ATTESTATION_PATH: publicAttestationPath,
        GITHUB_SHA: confirmatory.commit,
        GITHUB_REF: "refs/heads/main",
        GITHUB_REPOSITORY: "owner/ai-agent-personas",
        GITHUB_RUN_ID: "123456789",
        GITHUB_RUN_ATTEMPT: "1",
      },
    });
    assert.equal(writer.status, 0, writer.stderr);
    const publicAttestation = JSON.parse(readFileSync(publicAttestationPath, "utf8"));
    assert.equal(
      publicAttestation.privateEvidence.evaluatorEvidenceSha256,
      confirmatory.protocol.judge.evaluatorEvidenceSha256,
    );
    assert.equal(publicAttestation.runtime.rendererPolicySha256, RENDERER_POLICY_SHA256);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }

  const env = { ...process.env };
  delete env.PERSONA_LAYER_BENCHMARK_RESULT;
  const missing = spawnSync(process.execPath, [scriptPath], { encoding: "utf8", env });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /benchmark:persona-layers/);
});
