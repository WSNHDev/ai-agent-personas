import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildPersonaVoiceMessages } from "../packages/core/dist/index.js";

import {
  PERSONA_TASK_MODE_CATALOG,
  PERSONA_TASK_COMPATIBILITY_MATRIX_SHA256,
  getPersonaTaskModeCompatibility,
} from "./persona-task-compatibility.mjs";

export const PERSONA_LAYER_BENCHMARK_USAGE =
  "Usage: pnpm benchmark:persona-layers -- <private-result-v2.json> [--json] [--gate] [--expected-commit <git-sha>] [--randomization-mapping <private-file>] [--rater-attestation <private-file>] [--evaluator-evidence <private-file>]";

const benchmarkRootUrl = new URL("../benchmarks/persona-overhead/", import.meta.url);
const protocolUrl = new URL("protocol-v2.md", benchmarkRootUrl);
const samplePlanUrl = new URL("sample-plan-v2.json", benchmarkRootUrl);
const workloadCatalogUrl = new URL("workload-catalog-v2.json", benchmarkRootUrl);

function trackedArtifact(url) {
  const source = readFileSync(url);
  return {
    source,
    sha256: createHash("sha256").update(source).digest("hex"),
  };
}

const trackedProtocol = trackedArtifact(protocolUrl);
const trackedSamplePlan = trackedArtifact(samplePlanUrl);
const trackedWorkloadCatalog = trackedArtifact(workloadCatalogUrl);
const samplePlan = JSON.parse(trackedSamplePlan.source.toString("utf8"));
const workloadCatalog = JSON.parse(trackedWorkloadCatalog.source.toString("utf8"));

export const PERSONA_LAYER_PROTOCOL_SHA256 = trackedProtocol.sha256;
export const PERSONA_LAYER_SAMPLE_PLAN_SHA256 = trackedSamplePlan.sha256;
export const PERSONA_LAYER_WORKLOAD_CATALOG_SHA256 = trackedWorkloadCatalog.sha256;
export const PERSONA_LAYER_BOOTSTRAP_CONTRACT = Object.freeze({
  method: samplePlan.method,
  confidenceLevel: samplePlan.confidenceLevel,
  seed: samplePlan.seed,
  samples: samplePlan.samples,
});
export const PERSONA_LAYER_DECISION_CONTRACT = Object.freeze({
  ...samplePlan.decisionThresholds,
});

const MINIMUM_GUARDRAILS = Object.freeze({
  workloadPairs: samplePlan.minimumWorkloadPairs,
  compatibleTaskPairs: samplePlan.minimumCompatibleTaskPairs,
  ratersPerWorkload: samplePlan.minimumRatersPerWorkload,
  totalRaters: samplePlan.minimumTotalRaters,
});
const ARM_IDS = [
  "control",
  "length-matched-neutral",
  "legacy-global",
  "control-voice",
  "task-voice",
];
const SHA256 = /^[a-f0-9]{64}$/u;
const ID = /^[a-z0-9][a-z0-9._-]*$/u;
const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;
const GIT_SHA = /^[a-f0-9]{40}$/u;
const OPAQUE_ASSIGNMENT_ID = /^[A-Za-z0-9_-]{8,64}$/u;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const ONE_SIDED_95_Z = 1.6448536269514722;
const SIMULTANEOUS_95_Z = 1.959963984540054;
const PRIVATE_RANDOMIZATION_MAPPING_SCHEMA_VERSION = "1.0.0";
const PRIVATE_RATER_ATTESTATION_SCHEMA_VERSION = "1.0.0";
const PRIVATE_EVALUATOR_EVIDENCE_SCHEMA_VERSION = "1.0.0";
export const PERSONA_RENDERER_HOST_TEMPLATE_VERSION = "1.0.0";
export const PERSONA_RENDERER_HOST_TEMPLATE_SOURCE_CONTRACT =
  "packages/core/src/compiler.ts#wordCount+nonEmptyParagraphCount+voiceRuntimeControl+voiceMessages";
export const PERSONA_RENDERER_REQUEST_ENCODING_VERSION =
  "utf8-json-stringify-messages-newline-v1";
export const PERSONA_RENDERER_REQUEST_ENCODER_SOURCE_CONTRACT =
  "scripts/persona-layer-benchmark-report.mjs#decodeLosslessUtf8+encodePersonaRendererRequest";
export const PERSONA_RENDERER_PERSONAS_SOURCE = "../personas/";
const PERSONAS_DIRECTORY = fileURLToPath(
  new URL(PERSONA_RENDERER_PERSONAS_SOURCE, import.meta.url),
);
const RECOGNITION_INTERVAL_CONTRACT = Object.freeze({
  voiceRateLowerBound:
    "minimum of the workload-bootstrap lower bound and every workload one-sided Wilson lower bound",
  voiceLiftLowerBound:
    "minimum of the workload-bootstrap lower bound and every workload Newcombe-style lower bound from simultaneous Wilson intervals",
});

function object(value, path) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object.`);
  }
  return value;
}

function exactKeys(value, path, keys) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new TypeError(`${path} must contain exactly: ${expected.join(", ")}.`);
  }
}

function string(value, path) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${path} must be a non-empty string.`);
  }
  return value;
}

function id(value, path) {
  const result = string(value, path);
  if (!ID.test(result)) throw new TypeError(`${path} has an invalid identifier.`);
  return result;
}

function sha(value, path) {
  const result = string(value, path);
  if (!SHA256.test(result)) throw new TypeError(`${path} must be a lowercase SHA-256.`);
  return result;
}

function finite(value, path, minimum = 0) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum) {
    throw new TypeError(`${path} must be a finite number >= ${minimum}.`);
  }
  return value;
}

function integer(value, path, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new TypeError(`${path} must be an integer >= ${minimum}.`);
  }
  return value;
}

function nullableNumber(value, path, integerOnly = false) {
  if (value === null) return null;
  return integerOnly ? integer(value, path) : finite(value, path);
}

function oneOf(value, path, allowed) {
  if (!allowed.includes(value)) {
    throw new TypeError(`${path} must be one of: ${allowed.join(", ")}.`);
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function decodeLosslessUtf8(bytes, path) {
  const source = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(source);
  } catch {
    throw new TypeError(`${path} must be valid UTF-8.`);
  }
  if (!Buffer.from(text, "utf8").equals(source)) {
    throw new TypeError(`${path} must decode losslessly as UTF-8.`);
  }
  return text;
}

function whitespaceWordCount(text) {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/u).length;
}

export function encodePersonaRendererRequest(persona, solverArtifactBytes) {
  const sourceAnswer = decodeLosslessUtf8(
    solverArtifactBytes,
    "Voice renderer input solver artifact",
  );
  const messages = buildPersonaVoiceMessages(persona.id, sourceAnswer, {
    locale: persona.locale,
    intensity: persona.intensity,
    presentation: "persona",
    personasDirectory: PERSONAS_DIRECTORY,
  });
  return Buffer.from(`${JSON.stringify(messages)}\n`, "utf8");
}

function canonicalRendererRequestEncoderSource() {
  return [decodeLosslessUtf8, encodePersonaRendererRequest]
    .map((implementation) => implementation.toString().replace(/\r\n?/gu, "\n").trimEnd())
    .join("\n\n");
}

function canonicalVoiceRuntimeControlSource() {
  const source = readFileSync(
    new URL("../packages/core/src/compiler.ts", import.meta.url),
    "utf8",
  ).replace(/\r\n?/gu, "\n");
  const extract = (startMarker, endMarker) => {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    if (start < 0 || end < 0 || source.indexOf(startMarker, start + 1) >= 0) {
      throw new TypeError(
        `Canonical core compiler must contain exactly one ${startMarker} implementation before ${endMarker}.`,
      );
    }
    return source.slice(start, end).trimEnd();
  };
  return [
    extract("function wordCount(", "function assertPromptLength("),
    extract("function nonEmptyParagraphCount(", "function voiceRuntimeControl("),
    extract("function voiceRuntimeControl(", "function voiceMessages("),
    extract("function voiceMessages(", "export function buildPersonaVoiceMessagesManifest("),
  ].join("\n\n");
}

export function derivePersonaRendererPolicy(persona) {
  object(persona, "renderer policy persona");
  const personaId = id(persona.id, "renderer policy persona.id");
  const version = string(persona.version, "renderer policy persona.version");
  const manifestSchemaVersion = string(
    persona.manifestSchemaVersion,
    "renderer policy persona.manifestSchemaVersion",
  );
  const locale = oneOf(persona.locale, "renderer policy persona.locale", ["en", "ru"]);
  const intensity = oneOf(persona.intensity, "renderer policy persona.intensity", [
    "subtle",
    "balanced",
    "immersive",
  ]);
  const compiledRoot = new URL(
    `../packages/core/dist/compiled-v2/${personaId}/${locale}/voice/`,
    import.meta.url,
  );
  let compiledVoice;
  let compiledMetadata;
  try {
    compiledVoice = readFileSync(new URL(`${intensity}.txt`, compiledRoot));
    compiledMetadata = JSON.parse(
      readFileSync(new URL(`${intensity}.json`, compiledRoot), "utf8"),
    );
  } catch (error) {
    throw new TypeError(
      `Canonical compiled Voice assets are unavailable for ${personaId}/${locale}/${intensity}; build packages/core before running the benchmark gate. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (
    compiledMetadata.schemaVersion !== "2.0.0" ||
    compiledMetadata.manifestSchemaVersion !== manifestSchemaVersion ||
    compiledMetadata.id !== personaId ||
    compiledMetadata.version !== version ||
    compiledMetadata.locale !== locale ||
    compiledMetadata.intensity !== intensity ||
    compiledMetadata.layer !== "voice" ||
    compiledMetadata.prompt !== compiledVoice.toString("utf8")
  ) {
    throw new TypeError(
      `Canonical compiled Voice assets do not match ${personaId}/${locale}/${intensity}.`,
    );
  }
  const policy = {
    schemaVersion: "1.0.0",
    kind: "ai-agent-personas/renderer-policy",
    persona: {
      id: personaId,
      version,
      manifestSchemaVersion,
      locale,
      intensity,
    },
    compiledVoiceSha256: sha256(compiledVoice),
    hostTemplate: {
      version: PERSONA_RENDERER_HOST_TEMPLATE_VERSION,
      sourceContract: PERSONA_RENDERER_HOST_TEMPLATE_SOURCE_CONTRACT,
      sha256: sha256(canonicalVoiceRuntimeControlSource()),
    },
    requestEncoding: {
      version: PERSONA_RENDERER_REQUEST_ENCODING_VERSION,
      charset: "utf-8",
      serialization: "JSON.stringify(buildPersonaVoiceMessages(...)) followed by LF",
      personasSource: PERSONA_RENDERER_PERSONAS_SOURCE,
      sourceContract: PERSONA_RENDERER_REQUEST_ENCODER_SOURCE_CONTRACT,
      encoderSha256: sha256(canonicalRendererRequestEncoderSource()),
    },
  };
  return {
    ...policy,
    sha256: sha256(canonicalJson(policy)),
  };
}

export function derivePersonaRendererPolicySha256(persona) {
  return derivePersonaRendererPolicy(persona).sha256;
}

function validateTrackedBenchmarkArtifacts() {
  const expectedDecisionThresholds = {
    qualityMaximum: 100,
    nonInferiorityMargin: 3,
    taskQualityMinimumDelta: 1,
    tokenBudgetRatio: 1.25,
    timeBudgetRatio: 1.25,
    taskTokenBudgetRatio: 1.1,
    taskTimeBudgetRatio: 1.1,
    criticalSafetyThreshold: 0,
    preferenceScoreMinimum: 0.6,
    voiceRecognitionRateMinimum: 0.6,
    voiceRecognitionLiftMinimum: 0.3,
    secondaryNonInferiorityMargin: 0.5,
  };
  if (
    samplePlan.schemaVersion !== "1.0.0" ||
    samplePlan.method !== "one-sided-workload-bootstrap" ||
    samplePlan.confidenceLevel !== 0.95 ||
    samplePlan.seed !== 20260715 ||
    samplePlan.samples !== 10000 ||
    !Number.isInteger(samplePlan.minimumWorkloadPairs) ||
    samplePlan.minimumWorkloadPairs < 8 ||
    !Number.isInteger(samplePlan.minimumCompatibleTaskPairs) ||
    samplePlan.minimumCompatibleTaskPairs < 4 ||
    !Number.isInteger(samplePlan.minimumRatersPerWorkload) ||
    samplePlan.minimumRatersPerWorkload < 8 ||
    !Number.isInteger(samplePlan.minimumTotalRaters) ||
    samplePlan.minimumTotalRaters <
      samplePlan.minimumWorkloadPairs * samplePlan.minimumRatersPerWorkload
  ) {
    throw new TypeError("Tracked sample-plan-v2.json violates the executable v2 contract.");
  }
  const recognitionIntervals = object(
    samplePlan.recognitionIntervals,
    "tracked sample plan recognitionIntervals",
  );
  exactKeys(
    recognitionIntervals,
    "tracked sample plan recognitionIntervals",
    Object.keys(RECOGNITION_INTERVAL_CONTRACT),
  );
  for (const [key, expected] of Object.entries(RECOGNITION_INTERVAL_CONTRACT)) {
    if (recognitionIntervals[key] !== expected) {
      throw new TypeError(
        `Tracked sample-plan-v2.json recognitionIntervals.${key} must equal the executable contract.`,
      );
    }
  }
  const decisionThresholds = object(
    samplePlan.decisionThresholds,
    "tracked sample plan decisionThresholds",
  );
  exactKeys(
    decisionThresholds,
    "tracked sample plan decisionThresholds",
    Object.keys(expectedDecisionThresholds),
  );
  for (const [key, expected] of Object.entries(expectedDecisionThresholds)) {
    if (decisionThresholds[key] !== expected) {
      throw new TypeError(
        `Tracked sample-plan-v2.json decisionThresholds.${key} must equal ${expected}.`,
      );
    }
  }
  if (workloadCatalog.schemaVersion !== "1.0.0" || !Array.isArray(workloadCatalog.fixtures)) {
    throw new TypeError("Tracked workload-catalog-v2.json has an unsupported structure.");
  }
  const fixtureIds = new Set();
  for (const [index, fixture] of workloadCatalog.fixtures.entries()) {
    const path = `tracked workload catalog fixture[${index}]`;
    object(fixture, path);
    exactKeys(fixture, path, [
      "id",
      "personaId",
      "taskModeId",
      "family",
      "alignment",
      "path",
    ]);
    id(fixture.id, `${path}.id`);
    if (fixtureIds.has(fixture.id)) throw new TypeError(`${path}.id must be unique.`);
    fixtureIds.add(fixture.id);
    id(fixture.personaId, `${path}.personaId`);
    id(fixture.taskModeId, `${path}.taskModeId`);
    id(fixture.family, `${path}.family`);
    oneOf(fixture.alignment, `${path}.alignment`, ["persona-aligned", "persona-neutral"]);
    const compatibility = getPersonaTaskModeCompatibility(
      fixture.personaId,
      fixture.taskModeId,
      fixture.family,
    );
    if (
      (compatibility === "aligned" ? "persona-aligned" : "persona-neutral") !==
      fixture.alignment
    ) {
      throw new TypeError(`${path}.alignment conflicts with the tracked compatibility matrix.`);
    }
    const relativePath = string(fixture.path, `${path}.path`);
    if (relativePath.startsWith("/") || relativePath.includes("..") || !relativePath.startsWith("workloads/")) {
      throw new TypeError(`${path}.path must stay under the tracked workloads directory.`);
    }
    trackedArtifact(new URL(relativePath, benchmarkRootUrl));
  }
}

function trackedWorkloadFixture(fixtureId) {
  const matches = workloadCatalog.fixtures.filter((fixture) => fixture.id === fixtureId);
  if (matches.length !== 1) {
    throw new TypeError(
      `Tracked workload catalog must contain exactly one fixture "${fixtureId}"; found ${matches.length}.`,
    );
  }
  const fixture = matches[0];
  return {
    ...fixture,
    sha256: trackedArtifact(new URL(fixture.path, benchmarkRootUrl)).sha256,
  };
}

validateTrackedBenchmarkArtifacts();

function validateStage(value, path, rendererContract = null) {
  const stage = object(value, path);
  const baseKeys = [
    "artifactSha256",
    "promptSha256",
    "promptBytes",
    "promptWords",
    "modelRequests",
    "tokens",
    "elapsedSeconds",
  ];
  exactKeys(
    stage,
    path,
    rendererContract === null
      ? baseKeys
      : [
          ...baseKeys,
          "inputArtifactSha256",
          "rendererPolicySha256",
          "toolsEnabled",
          "toolPolicySha256",
        ],
  );
  sha(stage.artifactSha256, `${path}.artifactSha256`);
  sha(stage.promptSha256, `${path}.promptSha256`);
  integer(stage.promptBytes, `${path}.promptBytes`);
  integer(stage.promptWords, `${path}.promptWords`);
  nullableNumber(stage.modelRequests, `${path}.modelRequests`, true);
  nullableNumber(stage.elapsedSeconds, `${path}.elapsedSeconds`);
  const tokens = object(stage.tokens, `${path}.tokens`);
  exactKeys(tokens, `${path}.tokens`, ["input", "cachedInput", "reasoning", "output"]);
  for (const key of ["input", "cachedInput", "reasoning", "output"]) {
    nullableNumber(tokens[key], `${path}.tokens.${key}`, true);
  }
  if (rendererContract !== null) {
    if (sha(stage.inputArtifactSha256, `${path}.inputArtifactSha256`) !== rendererContract.inputArtifactSha256) {
      throw new TypeError(`${path}.inputArtifactSha256 must equal its arm solver artifact.`);
    }
    if (stage.toolsEnabled !== false) {
      throw new TypeError(`${path}.toolsEnabled must be false for output-only Voice.`);
    }
    if (sha(stage.rendererPolicySha256, `${path}.rendererPolicySha256`) !== rendererContract.rendererPolicySha256) {
      throw new TypeError(`${path}.rendererPolicySha256 must match the runtime renderer policy.`);
    }
    if (sha(stage.toolPolicySha256, `${path}.toolPolicySha256`) !== rendererContract.toolPolicySha256) {
      throw new TypeError(`${path}.toolPolicySha256 must match the runtime renderer tool policy.`);
    }
  }
  return stage;
}

function validateArm(value, path, expected, taskModeId, runtime) {
  const arm = object(value, path);
  exactKeys(arm, path, [
    "selection",
    "solver",
    "renderer",
    "taskQuality",
    "safety",
    "excludedReason",
  ]);
  const selection = object(arm.selection, `${path}.selection`);
  exactKeys(selection, `${path}.selection`, ["solver", "renderer", "taskModeId"]);
  oneOf(selection.solver, `${path}.selection.solver`, [
    "neutral",
    "length-matched-neutral",
    "legacy",
    "task",
  ]);
  oneOf(selection.renderer, `${path}.selection.renderer`, ["neutral", "voice"]);
  if (selection.taskModeId !== null) id(selection.taskModeId, `${path}.selection.taskModeId`);
  if (
    selection.solver !== expected.solver ||
    selection.renderer !== expected.renderer ||
    selection.taskModeId !== expected.taskModeId(taskModeId)
  ) {
    throw new TypeError(`${path}.selection does not match the registered ${expected.id} arm.`);
  }

  const solver = validateStage(arm.solver, `${path}.solver`);
  if (expected.renderer === "voice") {
    validateStage(arm.renderer, `${path}.renderer`, {
      inputArtifactSha256: solver.artifactSha256,
      rendererPolicySha256: runtime.rendererPolicySha256,
      toolPolicySha256: runtime.rendererToolPolicySha256,
    });
  } else if (arm.renderer !== null) {
    throw new TypeError(`${path}.renderer must be null for a neutral renderer.`);
  }

  if (arm.taskQuality !== null) {
    const quality = object(arm.taskQuality, `${path}.taskQuality`);
    exactKeys(quality, `${path}.taskQuality`, [
      "score",
      "maximum",
      "judge",
      "judgePayloadSha256",
    ]);
    const maximum = finite(quality.maximum, `${path}.taskQuality.maximum`, Number.EPSILON);
    if (maximum !== PERSONA_LAYER_DECISION_CONTRACT.qualityMaximum) {
      throw new TypeError(
        `${path}.taskQuality.maximum must match the preregistered quality scale.`,
      );
    }
    const score = finite(quality.score, `${path}.taskQuality.score`);
    if (score > maximum) throw new TypeError(`${path}.taskQuality.score exceeds maximum.`);
    oneOf(quality.judge, `${path}.taskQuality.judge`, ["human", "automated", "hybrid"]);
    sha(quality.judgePayloadSha256, `${path}.taskQuality.judgePayloadSha256`);
  }

  const safety = object(arm.safety, `${path}.safety`);
  exactKeys(safety, `${path}.safety`, ["criticalFailures", "nonCriticalFailures"]);
  if (!Array.isArray(safety.criticalFailures)) {
    throw new TypeError(`${path}.safety.criticalFailures must be an array.`);
  }
  safety.criticalFailures.forEach((failure, index) => {
    const item = object(failure, `${path}.safety.criticalFailures[${index}]`);
    exactKeys(item, `${path}.safety.criticalFailures[${index}]`, ["id", "description"]);
    id(item.id, `${path}.safety.criticalFailures[${index}].id`);
    string(item.description, `${path}.safety.criticalFailures[${index}].description`);
  });
  integer(safety.nonCriticalFailures, `${path}.safety.nonCriticalFailures`);
  if (arm.excludedReason !== null) string(arm.excludedReason, `${path}.excludedReason`);
  return arm;
}

const ARM_CONTRACTS = {
  control: { id: "control", solver: "neutral", renderer: "neutral", taskModeId: () => null },
  "length-matched-neutral": {
    id: "length-matched-neutral",
    solver: "length-matched-neutral",
    renderer: "neutral",
    taskModeId: () => null,
  },
  "legacy-global": {
    id: "legacy-global",
    solver: "legacy",
    renderer: "neutral",
    taskModeId: () => null,
  },
  "control-voice": {
    id: "control-voice",
    solver: "neutral",
    renderer: "voice",
    taskModeId: () => null,
  },
  "task-voice": {
    id: "task-voice",
    solver: "task",
    renderer: "voice",
    taskModeId: (value) => value,
  },
};

export function validatePersonaLayerBenchmarkResult(value) {
  const result = object(value, "result");
  exactKeys(result, "result", [
    "schemaVersion",
    "id",
    "runKind",
    "commit",
    "persona",
    "runtime",
    "protocol",
    "workloads",
    "ux",
  ]);
  if (result.schemaVersion !== 2) throw new TypeError("result.schemaVersion must be 2.");
  id(result.id, "result.id");
  oneOf(result.runKind, "result.runKind", [
    "protocol-validation",
    "pilot",
    "screening",
    "confirmatory",
  ]);
  if (typeof result.commit !== "string" || !/^[a-f0-9]{40}$/u.test(result.commit)) {
    throw new TypeError("result.commit must be a 40-character lowercase Git SHA.");
  }

  const persona = object(result.persona, "result.persona");
  exactKeys(persona, "result.persona", [
    "id",
    "version",
    "manifestSchemaVersion",
    "locale",
    "intensity",
    "taskModeId",
  ]);
  id(persona.id, "result.persona.id");
  id(persona.taskModeId, "result.persona.taskModeId");
  const canonicalPersona = PERSONA_TASK_MODE_CATALOG.find(
    (candidate) => candidate.id === persona.id,
  );
  if (canonicalPersona === undefined) {
    throw new TypeError("result.persona.id must reference one canonical v2 persona manifest.");
  }
  if (!SEMVER.test(persona.version)) {
    throw new TypeError("result.persona.version must be semantic version x.y.z.");
  }
  if (persona.version !== canonicalPersona.version) {
    throw new TypeError("result.persona.version must match its canonical v2 persona manifest.");
  }
  if (persona.manifestSchemaVersion !== canonicalPersona.schemaVersion) {
    throw new TypeError(
      "result.persona.manifestSchemaVersion must match its canonical v2 persona manifest.",
    );
  }
  if (!canonicalPersona.taskModeIds.includes(persona.taskModeId)) {
    throw new TypeError(
      "result.persona.taskModeId must reference its canonical v2 persona manifest.",
    );
  }
  oneOf(persona.locale, "result.persona.locale", ["en", "ru"]);
  oneOf(persona.intensity, "result.persona.intensity", ["subtle", "balanced", "immersive"]);

  const runtime = object(result.runtime, "result.runtime");
  exactKeys(runtime, "result.runtime", [
    "surface",
    "model",
    "modelSettingsSha256",
    "toolPolicySha256",
    "rendererPolicySha256",
    "rendererToolPolicySha256",
    "timingMode",
    "seed",
    "armOrder",
  ]);
  string(runtime.surface, "result.runtime.surface");
  string(runtime.model, "result.runtime.model");
  sha(runtime.modelSettingsSha256, "result.runtime.modelSettingsSha256");
  sha(runtime.toolPolicySha256, "result.runtime.toolPolicySha256");
  sha(runtime.rendererPolicySha256, "result.runtime.rendererPolicySha256");
  sha(runtime.rendererToolPolicySha256, "result.runtime.rendererToolPolicySha256");
  oneOf(runtime.timingMode, "result.runtime.timingMode", [
    "counterbalanced-sequential",
    "isolated-resources",
  ]);
  integer(runtime.seed, "result.runtime.seed");
  if (!Array.isArray(runtime.armOrder) || runtime.armOrder.length !== ARM_IDS.length) {
    throw new TypeError("result.runtime.armOrder must contain exactly five arms.");
  }
  if (new Set(runtime.armOrder).size !== ARM_IDS.length || ARM_IDS.some((arm) => !runtime.armOrder.includes(arm))) {
    throw new TypeError("result.runtime.armOrder must contain every registered arm exactly once.");
  }

  const protocol = object(result.protocol, "result.protocol");
  exactKeys(protocol, "result.protocol", [
    "protocolArtifactSha256",
    "compatibilityMatrixSha256",
    "workloadCatalogSha256",
    "lengthMatching",
    "nonInferiorityMargin",
    "taskQualityMinimumDelta",
    "confidence",
    "judge",
    "tokenBudgetRatio",
    "timeBudgetRatio",
    "taskTokenBudgetRatio",
    "taskTimeBudgetRatio",
    "criticalSafetyThreshold",
    "ux",
  ]);
  if (
    sha(protocol.protocolArtifactSha256, "result.protocol.protocolArtifactSha256") !==
    PERSONA_LAYER_PROTOCOL_SHA256
  ) {
    throw new TypeError(
      "result.protocol.protocolArtifactSha256 does not match tracked protocol-v2.md.",
    );
  }
  const matrixSha = sha(
    protocol.compatibilityMatrixSha256,
    "result.protocol.compatibilityMatrixSha256",
  );
  if (matrixSha !== PERSONA_TASK_COMPATIBILITY_MATRIX_SHA256) {
    throw new TypeError(
      "result.protocol.compatibilityMatrixSha256 does not match the tracked compatibility matrix.",
    );
  }
  if (
    sha(protocol.workloadCatalogSha256, "result.protocol.workloadCatalogSha256") !==
    PERSONA_LAYER_WORKLOAD_CATALOG_SHA256
  ) {
    throw new TypeError(
      "result.protocol.workloadCatalogSha256 does not match tracked workload-catalog-v2.json.",
    );
  }
  const nonInferiorityMargin = finite(
    protocol.nonInferiorityMargin,
    "result.protocol.nonInferiorityMargin",
  );
  if (nonInferiorityMargin > 100) {
    throw new TypeError("result.protocol.nonInferiorityMargin must be <= 100.");
  }
  if (nonInferiorityMargin !== PERSONA_LAYER_DECISION_CONTRACT.nonInferiorityMargin) {
    throw new TypeError(
      "result.protocol.nonInferiorityMargin must match tracked sample-plan-v2.json.",
    );
  }
  const taskQualityMinimumDelta = finite(
    protocol.taskQualityMinimumDelta,
    "result.protocol.taskQualityMinimumDelta",
  );
  if (taskQualityMinimumDelta <= 0 || taskQualityMinimumDelta > 100) {
    throw new TypeError("result.protocol.taskQualityMinimumDelta must be > 0 and <= 100.");
  }
  if (taskQualityMinimumDelta !== PERSONA_LAYER_DECISION_CONTRACT.taskQualityMinimumDelta) {
    throw new TypeError(
      "result.protocol.taskQualityMinimumDelta must match tracked sample-plan-v2.json.",
    );
  }
  for (const key of [
    "tokenBudgetRatio",
    "timeBudgetRatio",
    "taskTokenBudgetRatio",
    "taskTimeBudgetRatio",
  ]) {
    const ratioValue = finite(protocol[key], `result.protocol.${key}`, 1);
    if (ratioValue !== PERSONA_LAYER_DECISION_CONTRACT[key]) {
      throw new TypeError(`result.protocol.${key} must match tracked sample-plan-v2.json.`);
    }
  }
  if (
    protocol.criticalSafetyThreshold !==
    PERSONA_LAYER_DECISION_CONTRACT.criticalSafetyThreshold
  ) {
    throw new TypeError(
      "result.protocol.criticalSafetyThreshold must match tracked sample-plan-v2.json.",
    );
  }

  const confidence = object(protocol.confidence, "result.protocol.confidence");
  exactKeys(confidence, "result.protocol.confidence", [
    "method",
    "confidenceLevel",
    "seed",
    "samples",
    "minimumWorkloadPairs",
    "minimumCompatibleTaskPairs",
    "minimumRatersPerWorkload",
    "minimumTotalRaters",
    "samplePlanSha256",
  ]);
  if (
    confidence.method !== PERSONA_LAYER_BOOTSTRAP_CONTRACT.method ||
    confidence.confidenceLevel !== PERSONA_LAYER_BOOTSTRAP_CONTRACT.confidenceLevel ||
    confidence.seed !== PERSONA_LAYER_BOOTSTRAP_CONTRACT.seed ||
    confidence.samples !== PERSONA_LAYER_BOOTSTRAP_CONTRACT.samples
  ) {
    throw new TypeError(
      "result.protocol.confidence must use the fixed v2 one-sided workload-bootstrap contract.",
    );
  }
  const minimumWorkloadPairs = integer(
    confidence.minimumWorkloadPairs,
    "result.protocol.confidence.minimumWorkloadPairs",
    MINIMUM_GUARDRAILS.workloadPairs,
  );
  const minimumCompatibleTaskPairs = integer(
    confidence.minimumCompatibleTaskPairs,
    "result.protocol.confidence.minimumCompatibleTaskPairs",
    MINIMUM_GUARDRAILS.compatibleTaskPairs,
  );
  const minimumRatersPerWorkload = integer(
    confidence.minimumRatersPerWorkload,
    "result.protocol.confidence.minimumRatersPerWorkload",
    MINIMUM_GUARDRAILS.ratersPerWorkload,
  );
  const minimumTotalRaters = integer(
    confidence.minimumTotalRaters,
    "result.protocol.confidence.minimumTotalRaters",
    minimumWorkloadPairs * minimumRatersPerWorkload,
  );
  if (
    minimumWorkloadPairs !== MINIMUM_GUARDRAILS.workloadPairs ||
    minimumCompatibleTaskPairs !== MINIMUM_GUARDRAILS.compatibleTaskPairs ||
    minimumRatersPerWorkload !== MINIMUM_GUARDRAILS.ratersPerWorkload ||
    minimumTotalRaters !== MINIMUM_GUARDRAILS.totalRaters
  ) {
    throw new TypeError(
      "result.protocol.confidence sample guardrails must match tracked sample-plan-v2.json.",
    );
  }
  if (minimumTotalRaters < minimumWorkloadPairs * minimumRatersPerWorkload) {
    throw new TypeError(
      "result.protocol.confidence.minimumTotalRaters must cover every minimum workload pair.",
    );
  }
  if (
    sha(confidence.samplePlanSha256, "result.protocol.confidence.samplePlanSha256") !==
    PERSONA_LAYER_SAMPLE_PLAN_SHA256
  ) {
    throw new TypeError(
      "result.protocol.confidence.samplePlanSha256 does not match tracked sample-plan-v2.json.",
    );
  }

  const judge = object(protocol.judge, "result.protocol.judge");
  exactKeys(judge, "result.protocol.judge", [
    "identity",
    "version",
    "configurationSha256",
    "rubricSha256",
    "seed",
    "judgePayloadSha256",
    "evaluatorEvidenceSha256",
  ]);
  string(judge.identity, "result.protocol.judge.identity");
  string(judge.version, "result.protocol.judge.version");
  sha(judge.configurationSha256, "result.protocol.judge.configurationSha256");
  sha(judge.rubricSha256, "result.protocol.judge.rubricSha256");
  integer(judge.seed, "result.protocol.judge.seed");
  sha(judge.judgePayloadSha256, "result.protocol.judge.judgePayloadSha256");
  sha(judge.evaluatorEvidenceSha256, "result.protocol.judge.evaluatorEvidenceSha256");

  const lengthMatching = object(protocol.lengthMatching, "result.protocol.lengthMatching");
  exactKeys(lengthMatching, "result.protocol.lengthMatching", [
    "method",
    "targetArm",
    "toleranceWords",
    "planSha256",
  ]);
  string(lengthMatching.method, "result.protocol.lengthMatching.method");
  if (lengthMatching.targetArm !== "legacy-global") {
    throw new TypeError("result.protocol.lengthMatching.targetArm must be legacy-global.");
  }
  const toleranceWords = integer(
    lengthMatching.toleranceWords,
    "result.protocol.lengthMatching.toleranceWords",
  );
  if (toleranceWords > 10) {
    throw new TypeError("result.protocol.lengthMatching.toleranceWords must be <= 10.");
  }
  sha(lengthMatching.planSha256, "result.protocol.lengthMatching.planSha256");

  const uxProtocol = object(protocol.ux, "result.protocol.ux");
  exactKeys(uxProtocol, "result.protocol.ux", [
    "humanRated",
    "armLabelsBlinded",
    "presentationRandomized",
    "randomizationMappingSha256",
    "raterAttestationSha256",
    "dimensions",
    "preferenceScoreMinimum",
    "voiceRecognitionRateMinimum",
    "voiceRecognitionLiftMinimum",
    "secondaryNonInferiorityMargin",
  ]);
  if (uxProtocol.humanRated !== true || uxProtocol.armLabelsBlinded !== true || uxProtocol.presentationRandomized !== true) {
    throw new TypeError("result.protocol.ux must require human ratings, blinded labels, and randomized presentation.");
  }
  sha(uxProtocol.randomizationMappingSha256, "result.protocol.ux.randomizationMappingSha256");
  sha(uxProtocol.raterAttestationSha256, "result.protocol.ux.raterAttestationSha256");
  const dimensions = [
    "pairwise-preference",
    "persona-identification",
    "clarity",
    "trust",
    "perceived-effort",
    "intent-to-reuse",
  ];
  if (JSON.stringify(uxProtocol.dimensions) !== JSON.stringify(dimensions)) {
    throw new TypeError("result.protocol.ux.dimensions must contain the six registered UX dimensions in order.");
  }
  const preferenceScoreMinimum = finite(
    uxProtocol.preferenceScoreMinimum,
    "result.protocol.ux.preferenceScoreMinimum",
  );
  if (preferenceScoreMinimum <= 0.5 || preferenceScoreMinimum > 1) {
    throw new TypeError("result.protocol.ux.preferenceScoreMinimum must be > 0.5 and <= 1.");
  }
  if (
    preferenceScoreMinimum !== PERSONA_LAYER_DECISION_CONTRACT.preferenceScoreMinimum
  ) {
    throw new TypeError(
      "result.protocol.ux.preferenceScoreMinimum must match tracked sample-plan-v2.json.",
    );
  }
  for (const key of ["voiceRecognitionRateMinimum", "voiceRecognitionLiftMinimum"]) {
    const threshold = finite(uxProtocol[key], `result.protocol.ux.${key}`);
    if (threshold <= 0 || threshold > 1) {
      throw new TypeError(`result.protocol.ux.${key} must be > 0 and <= 1.`);
    }
    if (threshold !== PERSONA_LAYER_DECISION_CONTRACT[key]) {
      throw new TypeError(`result.protocol.ux.${key} must match tracked sample-plan-v2.json.`);
    }
  }
  const secondaryNonInferiorityMargin = finite(
    uxProtocol.secondaryNonInferiorityMargin,
    "result.protocol.ux.secondaryNonInferiorityMargin",
  );
  if (secondaryNonInferiorityMargin > 6) {
    throw new TypeError("result.protocol.ux.secondaryNonInferiorityMargin must be <= 6.");
  }
  if (
    secondaryNonInferiorityMargin !==
    PERSONA_LAYER_DECISION_CONTRACT.secondaryNonInferiorityMargin
  ) {
    throw new TypeError(
      "result.protocol.ux.secondaryNonInferiorityMargin must match tracked sample-plan-v2.json.",
    );
  }

  if (!Array.isArray(result.workloads) || result.workloads.length < 2) {
    throw new TypeError("result.workloads must contain at least two workloads.");
  }
  const workloadIds = new Set();
  const fixtureIds = new Set();
  const fixtureHashes = new Set();
  let taskQualityMaximum = null;
  const workloads = result.workloads.map((raw, workloadIndex) => {
    const path = `result.workloads[${workloadIndex}]`;
    const workload = object(raw, path);
    exactKeys(workload, path, [
      "id",
      "family",
      "fixtureId",
      "fixtureSha256",
      "alignment",
      "taskModeCompatible",
      "arms",
    ]);
    const workloadId = id(workload.id, `${path}.id`);
    if (workloadIds.has(workloadId)) throw new TypeError(`${path}.id must be unique.`);
    workloadIds.add(workloadId);
    id(workload.family, `${path}.family`);
    const fixtureId = id(workload.fixtureId, `${path}.fixtureId`);
    if (fixtureIds.has(fixtureId)) {
      throw new TypeError(`${path}.fixtureId must be unique across independent workload pairs.`);
    }
    fixtureIds.add(fixtureId);
    const fixture = trackedWorkloadFixture(fixtureId);
    if (
      fixture.personaId !== persona.id ||
      fixture.taskModeId !== persona.taskModeId ||
      fixture.family !== workload.family ||
      fixture.alignment !== workload.alignment
    ) {
      throw new TypeError(`${path} does not match its tracked workload fixture catalog entry.`);
    }
    const fixtureSha256 = sha(workload.fixtureSha256, `${path}.fixtureSha256`);
    if (fixtureSha256 !== fixture.sha256) {
      throw new TypeError(`${path}.fixtureSha256 does not match its tracked workload fixture.`);
    }
    if (fixtureHashes.has(fixtureSha256)) {
      throw new TypeError(
        `${path}.fixtureSha256 must be unique across independent workload pairs.`,
      );
    }
    fixtureHashes.add(fixtureSha256);
    oneOf(workload.alignment, `${path}.alignment`, ["persona-aligned", "persona-neutral"]);
    if (typeof workload.taskModeCompatible !== "boolean") {
      throw new TypeError(`${path}.taskModeCompatible must be boolean.`);
    }
    const compatibility = getPersonaTaskModeCompatibility(
      persona.id,
      persona.taskModeId,
      workload.family,
    );
    const matrixCompatible = compatibility === "aligned";
    if (workload.taskModeCompatible !== matrixCompatible) {
      throw new TypeError(
        `${path}.taskModeCompatible does not match the tracked compatibility matrix.`,
      );
    }
    const expectedAlignment = matrixCompatible ? "persona-aligned" : "persona-neutral";
    if (workload.alignment !== expectedAlignment) {
      throw new TypeError(`${path}.alignment does not match the tracked compatibility matrix.`);
    }
    const arms = object(workload.arms, `${path}.arms`);
    exactKeys(arms, `${path}.arms`, ARM_IDS);
    for (const armId of ARM_IDS) {
      validateArm(
        arms[armId],
        `${path}.arms.${armId}`,
        ARM_CONTRACTS[armId],
        persona.taskModeId,
        runtime,
      );
      if (
        arms[armId].taskQuality !== null &&
        arms[armId].taskQuality.judgePayloadSha256 !== judge.judgePayloadSha256
      ) {
        throw new TypeError(
          `${path}.arms.${armId}.taskQuality must use the preregistered judge payload.`,
        );
      }
      if (arms[armId].taskQuality !== null) {
        if (taskQualityMaximum === null) {
          taskQualityMaximum = arms[armId].taskQuality.maximum;
        } else if (arms[armId].taskQuality.maximum !== taskQualityMaximum) {
          throw new TypeError(
            `${path}.arms.${armId}.taskQuality.maximum must match the global preregistered judge scale.`,
          );
        }
      }
    }
    if (workload.taskModeCompatible && arms["task-voice"].excludedReason !== null) {
      throw new TypeError(`${path}.arms.task-voice.excludedReason must be null for a compatible Task mode.`);
    }
    if (!workload.taskModeCompatible && arms["task-voice"].excludedReason === null) {
      throw new TypeError(`${path}.arms.task-voice.excludedReason must explain why the Task comparison is excluded.`);
    }
    if (JSON.stringify(arms.control.solver) !== JSON.stringify(arms["control-voice"].solver)) {
      throw new TypeError(
        `${path} control and control-voice must reuse the identical solver stage and artifact.`,
      );
    }
    for (const armId of ["control-voice", "task-voice"]) {
      const controlQuality = arms.control.taskQuality;
      const candidateQuality = arms[armId].taskQuality;
      if (
        controlQuality !== null &&
        candidateQuality !== null &&
        controlQuality.maximum !== candidateQuality.maximum
      ) {
        throw new TypeError(
          `${path}.arms.${armId}.taskQuality.maximum must match the control scale.`,
        );
      }
    }
    const lengthDelta = Math.abs(
      arms["length-matched-neutral"].solver.promptWords - arms["legacy-global"].solver.promptWords,
    );
    if (lengthDelta > lengthMatching.toleranceWords) {
      throw new TypeError(`${path} length-matched prompt exceeds the preregistered tolerance.`);
    }
    return workload;
  });
  if (!workloads.some((item) => item.alignment === "persona-aligned") || !workloads.some((item) => item.alignment === "persona-neutral")) {
    throw new TypeError("result.workloads must include persona-aligned and persona-neutral tasks.");
  }

  if (!Array.isArray(result.ux) || result.ux.length === 0) {
    throw new TypeError("result.ux must contain human ratings.");
  }
  const uxWorkloads = new Set();
  for (const [index, raw] of result.ux.entries()) {
    const path = `result.ux[${index}]`;
    const ux = object(raw, path);
    exactKeys(ux, path, [
      "workloadId",
      "raters",
      "preference",
      "personaIdentification",
      "clarity",
      "trust",
      "perceivedEffort",
      "intentToReuse",
    ]);
    const workloadId = id(ux.workloadId, `${path}.workloadId`);
    if (!workloadIds.has(workloadId) || uxWorkloads.has(workloadId)) {
      throw new TypeError(`${path}.workloadId must reference one unique workload.`);
    }
    uxWorkloads.add(workloadId);
    const raters = integer(ux.raters, `${path}.raters`, 1);
    const preference = object(ux.preference, `${path}.preference`);
    exactKeys(preference, `${path}.preference`, ["control", "voice", "tie"]);
    const preferenceTotal = ["control", "voice", "tie"].reduce(
      (total, key) => total + integer(preference[key], `${path}.preference.${key}`),
      0,
    );
    if (preferenceTotal !== raters) throw new TypeError(`${path}.preference must sum to raters.`);
    const personaIdentification = object(
      ux.personaIdentification,
      `${path}.personaIdentification`,
    );
    exactKeys(personaIdentification, `${path}.personaIdentification`, ["control", "voice"]);
    for (const armId of ["control", "voice"]) {
      const countsPath = `${path}.personaIdentification.${armId}`;
      const counts = object(personaIdentification[armId], countsPath);
      exactKeys(counts, countsPath, ["correct", "incorrect", "unsure"]);
      const total = ["correct", "incorrect", "unsure"].reduce(
        (sum, key) => sum + integer(counts[key], `${countsPath}.${key}`),
        0,
      );
      if (total !== raters) throw new TypeError(`${countsPath} must sum to raters.`);
    }
    for (const dimension of ["clarity", "trust", "perceivedEffort", "intentToReuse"]) {
      const pair = object(ux[dimension], `${path}.${dimension}`);
      exactKeys(pair, `${path}.${dimension}`, ["control", "voice"]);
      for (const key of ["control", "voice"]) {
        const rating = finite(pair[key], `${path}.${dimension}.${key}`, 1);
        if (rating > 7) throw new TypeError(`${path}.${dimension}.${key} must be <= 7.`);
      }
    }
  }
  if (uxWorkloads.size !== workloads.length) {
    throw new TypeError("result.ux must contain one human-rating record for every workload.");
  }

  return result;
}

function stageTokens(stage) {
  const values = Object.values(stage.tokens);
  return values.every((value) => value !== null)
    ? values.reduce((total, value) => total + value, 0)
    : null;
}

function armTotals(arm) {
  const solverTokens = stageTokens(arm.solver);
  const rendererTokens = arm.renderer ? stageTokens(arm.renderer) : 0;
  const tokens = solverTokens === null || rendererTokens === null ? null : solverTokens + rendererTokens;
  const solverSeconds = arm.solver.elapsedSeconds;
  const rendererSeconds = arm.renderer?.elapsedSeconds ?? 0;
  const elapsedSeconds = solverSeconds === null || rendererSeconds === null ? null : solverSeconds + rendererSeconds;
  return { tokens, elapsedSeconds };
}

function ratio(numerator, denominator) {
  return numerator === null || denominator === null || denominator === 0
    ? null
    : numerator / denominator;
}

function rounded(value) {
  return value === null ? null : Math.round(value * 1000000) / 1000000;
}

function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON does not allow non-finite numbers.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  throw new TypeError(`Canonical JSON does not allow ${typeof value}.`);
}

export function personaLayerAggregateUxSha256(ux) {
  if (!Array.isArray(ux)) throw new TypeError("aggregate UX must be an array.");
  return createHash("sha256").update(canonicalJson(ux)).digest("hex");
}

function evidenceContents(value, path) {
  if (typeof value === "string" || Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return value;
  }
  throw new TypeError(`${path} must be private artifact contents.`);
}

function privateJson(contents, path) {
  return object(JSON.parse(Buffer.from(contents).toString("utf8")), path);
}

function outputStage(arm) {
  return arm.renderer ?? arm.solver;
}

function validateRandomizationMapping(mapping, result) {
  exactKeys(mapping, "private randomization mapping", [
    "schemaVersion",
    "resultId",
    "commit",
    "workloads",
  ]);
  if (mapping.schemaVersion !== PRIVATE_RANDOMIZATION_MAPPING_SCHEMA_VERSION) {
    throw new TypeError(
      `private randomization mapping.schemaVersion must be ${PRIVATE_RANDOMIZATION_MAPPING_SCHEMA_VERSION}.`,
    );
  }
  if (mapping.resultId !== result.id || mapping.commit !== result.commit) {
    throw new TypeError("private randomization mapping must bind the exact result ID and commit.");
  }
  if (!Array.isArray(mapping.workloads) || mapping.workloads.length !== result.workloads.length) {
    throw new TypeError(
      "private randomization mapping.workloads must cover every result workload exactly once.",
    );
  }
  const resultWorkloads = new Map(result.workloads.map((workload) => [workload.id, workload]));
  const workloadIds = new Set();
  const opaqueIds = new Set();
  for (const [index, raw] of mapping.workloads.entries()) {
    const path = `private randomization mapping.workloads[${index}]`;
    const workload = object(raw, path);
    exactKeys(workload, path, ["workloadId", "assignments"]);
    const workloadId = id(workload.workloadId, `${path}.workloadId`);
    if (workloadIds.has(workloadId) || !resultWorkloads.has(workloadId)) {
      throw new TypeError(`${path}.workloadId must reference one unique result workload.`);
    }
    workloadIds.add(workloadId);
    if (!Array.isArray(workload.assignments) || workload.assignments.length !== 2) {
      throw new TypeError(`${path}.assignments must contain exactly control and control-voice.`);
    }
    const resultWorkload = resultWorkloads.get(workloadId);
    const arms = new Set();
    const positions = new Set();
    for (const [assignmentIndex, rawAssignment] of workload.assignments.entries()) {
      const assignmentPath = `${path}.assignments[${assignmentIndex}]`;
      const assignment = object(rawAssignment, assignmentPath);
      exactKeys(assignment, assignmentPath, [
        "opaqueId",
        "position",
        "armId",
        "artifactSha256",
      ]);
      const armId = oneOf(assignment.armId, `${assignmentPath}.armId`, [
        "control",
        "control-voice",
      ]);
      if (arms.has(armId)) throw new TypeError(`${assignmentPath}.armId must be unique.`);
      arms.add(armId);
      const position = oneOf(assignment.position, `${assignmentPath}.position`, [
        "first",
        "second",
      ]);
      if (positions.has(position)) throw new TypeError(`${assignmentPath}.position must be unique.`);
      positions.add(position);
      const opaqueId = string(assignment.opaqueId, `${assignmentPath}.opaqueId`);
      if (
        !OPAQUE_ASSIGNMENT_ID.test(opaqueId) ||
        /control|voice/iu.test(opaqueId) ||
        opaqueIds.has(opaqueId)
      ) {
        throw new TypeError(
          `${assignmentPath}.opaqueId must be globally unique, opaque, and 8-64 safe characters.`,
        );
      }
      opaqueIds.add(opaqueId);
      const expectedArtifactSha256 = outputStage(resultWorkload.arms[armId]).artifactSha256;
      if (sha(assignment.artifactSha256, `${assignmentPath}.artifactSha256`) !== expectedArtifactSha256) {
        throw new TypeError(`${assignmentPath}.artifactSha256 does not match its result arm output.`);
      }
    }
    if (arms.size !== 2 || positions.size !== 2) {
      throw new TypeError(`${path}.assignments must cover both UX arms and positions.`);
    }
  }
  return true;
}

function validateEvidencePayload(value, path, expectedSha256) {
  const payload = object(value, path);
  exactKeys(payload, path, ["sha256", "base64"]);
  const declaredSha256 = sha(payload.sha256, `${path}.sha256`);
  const base64 = string(payload.base64, `${path}.base64`);
  if (!BASE64.test(base64)) throw new TypeError(`${path}.base64 must use canonical base64.`);
  const decoded = Buffer.from(base64, "base64");
  if (decoded.length === 0 || decoded.toString("base64") !== base64) {
    throw new TypeError(`${path}.base64 must encode a non-empty canonical byte payload.`);
  }
  const actualSha256 = sha256(decoded);
  if (declaredSha256 !== actualSha256 || declaredSha256 !== expectedSha256) {
    throw new TypeError(`${path} does not hash to the expected checkout/result digest.`);
  }
  return decoded;
}

function validateEvaluatorStageEvidence(value, path, resultStage, expectedModelSettingsSha256, expectedToolPolicySha256) {
  const stage = object(value, path);
  exactKeys(stage, path, [
    "prompt",
    "artifact",
    "modelSettingsSha256",
    "toolPolicySha256",
  ]);
  const prompt = validateEvidencePayload(
    stage.prompt,
    `${path}.prompt`,
    resultStage.promptSha256,
  );
  const artifact = validateEvidencePayload(
    stage.artifact,
    `${path}.artifact`,
    resultStage.artifactSha256,
  );
  const promptText = decodeLosslessUtf8(prompt, `${path}.prompt`);
  if (resultStage.promptBytes !== prompt.length) {
    throw new TypeError(`${path}.prompt byte length does not match resultStage.promptBytes.`);
  }
  if (resultStage.promptWords !== whitespaceWordCount(promptText)) {
    throw new TypeError(
      `${path}.prompt whitespace word count does not match resultStage.promptWords.`,
    );
  }
  if (sha(stage.modelSettingsSha256, `${path}.modelSettingsSha256`) !== expectedModelSettingsSha256) {
    throw new TypeError(`${path}.modelSettingsSha256 does not match the validated settings payload.`);
  }
  if (sha(stage.toolPolicySha256, `${path}.toolPolicySha256`) !== expectedToolPolicySha256) {
    throw new TypeError(`${path}.toolPolicySha256 does not match the validated tool-policy payload.`);
  }
  return { prompt, artifact };
}

function validateEvaluatorEvidence(evidence, result) {
  exactKeys(evidence, "private evaluator evidence", [
    "schemaVersion",
    "resultId",
    "commit",
    "evaluatorIdentity",
    "evaluatorVersion",
    "judgeSeed",
    "completedAt",
    "payloads",
    "workloads",
  ]);
  if (evidence.schemaVersion !== PRIVATE_EVALUATOR_EVIDENCE_SCHEMA_VERSION) {
    throw new TypeError(
      `private evaluator evidence.schemaVersion must be ${PRIVATE_EVALUATOR_EVIDENCE_SCHEMA_VERSION}.`,
    );
  }
  if (evidence.resultId !== result.id || evidence.commit !== result.commit) {
    throw new TypeError("private evaluator evidence must bind the exact result ID and commit.");
  }
  if (
    evidence.evaluatorIdentity !== result.protocol.judge.identity ||
    evidence.evaluatorVersion !== result.protocol.judge.version
  ) {
    throw new TypeError("private evaluator evidence must bind the preregistered evaluator identity/version.");
  }
  if (evidence.judgeSeed !== result.protocol.judge.seed) {
    throw new TypeError("private evaluator evidence.judgeSeed must bind the preregistered seed.");
  }
  if (typeof evidence.completedAt !== "string" || Number.isNaN(Date.parse(evidence.completedAt))) {
    throw new TypeError("private evaluator evidence.completedAt must be an ISO timestamp.");
  }
  const payloads = object(evidence.payloads, "private evaluator evidence.payloads");
  exactKeys(payloads, "private evaluator evidence.payloads", [
    "modelSettings",
    "solverToolPolicy",
    "rendererToolPolicy",
    "judgeConfiguration",
    "judgeRubric",
    "judgePayload",
  ]);
  validateEvidencePayload(
    payloads.modelSettings,
    "private evaluator evidence.payloads.modelSettings",
    result.runtime.modelSettingsSha256,
  );
  validateEvidencePayload(
    payloads.solverToolPolicy,
    "private evaluator evidence.payloads.solverToolPolicy",
    result.runtime.toolPolicySha256,
  );
  validateEvidencePayload(
    payloads.rendererToolPolicy,
    "private evaluator evidence.payloads.rendererToolPolicy",
    result.runtime.rendererToolPolicySha256,
  );
  validateEvidencePayload(
    payloads.judgeConfiguration,
    "private evaluator evidence.payloads.judgeConfiguration",
    result.protocol.judge.configurationSha256,
  );
  validateEvidencePayload(
    payloads.judgeRubric,
    "private evaluator evidence.payloads.judgeRubric",
    result.protocol.judge.rubricSha256,
  );
  validateEvidencePayload(
    payloads.judgePayload,
    "private evaluator evidence.payloads.judgePayload",
    result.protocol.judge.judgePayloadSha256,
  );
  if (!Array.isArray(evidence.workloads) || evidence.workloads.length !== result.workloads.length) {
    throw new TypeError("private evaluator evidence.workloads must cover every result workload.");
  }
  const resultWorkloads = new Map(result.workloads.map((workload) => [workload.id, workload]));
  const workloadIds = new Set();
  for (const [index, raw] of evidence.workloads.entries()) {
    const path = `private evaluator evidence.workloads[${index}]`;
    const workload = object(raw, path);
    exactKeys(workload, path, ["workloadId", "arms"]);
    const workloadId = id(workload.workloadId, `${path}.workloadId`);
    if (workloadIds.has(workloadId) || !resultWorkloads.has(workloadId)) {
      throw new TypeError(`${path}.workloadId must reference one unique result workload.`);
    }
    workloadIds.add(workloadId);
    const resultWorkload = resultWorkloads.get(workloadId);
    const arms = object(workload.arms, `${path}.arms`);
    exactKeys(arms, `${path}.arms`, ARM_IDS);
    for (const armId of ARM_IDS) {
      const armPath = `${path}.arms.${armId}`;
      const arm = object(arms[armId], armPath);
      exactKeys(arm, armPath, ["solver", "renderer", "taskQuality", "safety"]);
      const resultArm = resultWorkload.arms[armId];
      const solverEvidence = validateEvaluatorStageEvidence(
        arm.solver,
        `${armPath}.solver`,
        resultArm.solver,
        result.runtime.modelSettingsSha256,
        result.runtime.toolPolicySha256,
      );
      if (resultArm.renderer === null) {
        if (arm.renderer !== null) throw new TypeError(`${armPath}.renderer must be null.`);
      } else {
        const rendererEvidence = validateEvaluatorStageEvidence(
          arm.renderer,
          `${armPath}.renderer`,
          resultArm.renderer,
          result.runtime.modelSettingsSha256,
          result.runtime.rendererToolPolicySha256,
        );
        const canonicalRequest = encodePersonaRendererRequest(
          result.persona,
          solverEvidence.artifact,
        );
        if (!rendererEvidence.prompt.equals(canonicalRequest)) {
          throw new TypeError(
            `${armPath}.renderer.prompt must exactly equal the ${PERSONA_RENDERER_REQUEST_ENCODING_VERSION} request reconstructed from the exact solver artifact.`,
          );
        }
      }
      if (resultArm.taskQuality === null) {
        if (arm.taskQuality !== null) throw new TypeError(`${armPath}.taskQuality must be null.`);
      } else {
        const quality = object(arm.taskQuality, `${armPath}.taskQuality`);
        exactKeys(quality, `${armPath}.taskQuality`, [
          "score",
          "maximum",
          "judge",
          "judgePayloadSha256",
        ]);
        if (
          quality.score !== resultArm.taskQuality.score ||
          quality.maximum !== resultArm.taskQuality.maximum ||
          quality.judge !== resultArm.taskQuality.judge ||
          quality.judgePayloadSha256 !== resultArm.taskQuality.judgePayloadSha256
        ) {
          throw new TypeError(`${armPath}.taskQuality does not match the recorded result score.`);
        }
      }
      if (canonicalJson(arm.safety) !== canonicalJson(resultArm.safety)) {
        throw new TypeError(`${armPath}.safety does not match the recorded result evidence.`);
      }
    }
  }
  return true;
}

function validateRaterAttestation(attestation, result, evaluatorEvidenceSha256) {
  exactKeys(attestation, "private rater attestation", [
    "schemaVersion",
    "resultId",
    "commit",
    "randomizationMappingSha256",
    "aggregateUxSha256",
    "evaluatorEvidenceSha256",
    "collectorIdentity",
    "collectorVersion",
    "completedAt",
    "attestations",
  ]);
  if (attestation.schemaVersion !== PRIVATE_RATER_ATTESTATION_SCHEMA_VERSION) {
    throw new TypeError(
      `private rater attestation.schemaVersion must be ${PRIVATE_RATER_ATTESTATION_SCHEMA_VERSION}.`,
    );
  }
  if (attestation.resultId !== result.id || attestation.commit !== result.commit) {
    throw new TypeError("private rater attestation must bind the exact result ID and commit.");
  }
  if (attestation.randomizationMappingSha256 !== result.protocol.ux.randomizationMappingSha256) {
    throw new TypeError("private rater attestation must bind the randomization mapping.");
  }
  if (attestation.aggregateUxSha256 !== personaLayerAggregateUxSha256(result.ux)) {
    throw new TypeError("private rater attestation must bind the canonical aggregate UX.");
  }
  if (
    attestation.evaluatorEvidenceSha256 !== evaluatorEvidenceSha256 ||
    attestation.evaluatorEvidenceSha256 !== result.protocol.judge.evaluatorEvidenceSha256
  ) {
    throw new TypeError("private rater attestation must bind the validated evaluator evidence.");
  }
  string(attestation.collectorIdentity, "private rater attestation.collectorIdentity");
  string(attestation.collectorVersion, "private rater attestation.collectorVersion");
  if (typeof attestation.completedAt !== "string" || Number.isNaN(Date.parse(attestation.completedAt))) {
    throw new TypeError("private rater attestation.completedAt must be an ISO timestamp.");
  }
  const attestations = object(attestation.attestations, "private rater attestation.attestations");
  exactKeys(attestations, "private rater attestation.attestations", [
    "humanRating",
    "blinding",
    "consent",
    "eligibility",
    "pseudonymousRaterUniqueness",
  ]);
  for (const key of [
    "humanRating",
    "blinding",
    "consent",
    "eligibility",
    "pseudonymousRaterUniqueness",
  ]) {
    if (attestations[key] !== true) {
      throw new TypeError(`private rater attestation.attestations.${key} must be true.`);
    }
  }
  return true;
}

function privateEvidenceStatus(result, options) {
  const expectedCommit = options.expectedCommit ?? null;
  const commit = expectedCommit === null
    ? { status: "missing" }
    : GIT_SHA.test(expectedCommit)
      ? {
          status: expectedCommit === result.commit ? "verified" : "mismatch",
        }
      : { status: "invalid" };

  let rendererPolicy;
  try {
    const expected = derivePersonaRendererPolicy(result.persona);
    rendererPolicy = {
      status: expected.sha256 === result.runtime.rendererPolicySha256 ? "verified" : "mismatch",
      expectedSha256: expected.sha256,
      actualSha256: result.runtime.rendererPolicySha256,
      hostTemplateVersion: PERSONA_RENDERER_HOST_TEMPLATE_VERSION,
    };
  } catch {
    rendererPolicy = {
      status: "invalid",
      expectedSha256: null,
      actualSha256: result.runtime.rendererPolicySha256,
      hostTemplateVersion: PERSONA_RENDERER_HOST_TEMPLATE_VERSION,
    };
  }

  const randomizationContents = options.randomizationMappingContents ?? null;
  let randomization = { status: "missing" };
  if (randomizationContents !== null) {
    const contents = evidenceContents(randomizationContents, "randomization mapping");
    const actualSha256 = sha256(contents);
    if (actualSha256 !== result.protocol.ux.randomizationMappingSha256) {
      randomization = { status: "mismatch" };
    } else {
      try {
        validateRandomizationMapping(privateJson(contents, "private randomization mapping"), result);
        randomization = { status: "verified" };
      } catch {
        randomization = { status: "invalid" };
      }
    }
  }

  const evaluatorContents = options.evaluatorEvidenceContents ?? null;
  let evaluatorEvidence = { status: "missing" };
  let evaluatorEvidenceSha256 = null;
  if (evaluatorContents !== null) {
    const contents = evidenceContents(evaluatorContents, "evaluator evidence");
    evaluatorEvidenceSha256 = sha256(contents);
    if (evaluatorEvidenceSha256 !== result.protocol.judge.evaluatorEvidenceSha256) {
      evaluatorEvidence = { status: "mismatch" };
    } else {
      try {
        validateEvaluatorEvidence(privateJson(contents, "private evaluator evidence"), result);
        evaluatorEvidence = { status: "verified" };
      } catch {
        evaluatorEvidence = { status: "invalid" };
      }
    }
  }

  const attestationContents = options.raterAttestationContents ?? null;
  let raterAttestation = { status: "missing" };
  if (attestationContents !== null) {
    const contents = evidenceContents(attestationContents, "rater attestation");
    const actualSha256 = createHash("sha256").update(contents).digest("hex");
    if (actualSha256 !== result.protocol.ux.raterAttestationSha256) {
      raterAttestation = { status: "mismatch" };
    } else {
      try {
        const attestation = privateJson(contents, "private rater attestation");
        validateRaterAttestation(attestation, result, evaluatorEvidenceSha256);
        raterAttestation = { status: "verified" };
      } catch {
        raterAttestation = { status: "invalid" };
      }
    }
  }

  return {
    commit,
    rendererPolicy,
    randomizationMapping: randomization,
    raterAttestation,
    evaluatorEvidence,
    verified:
      commit.status === "verified" &&
      rendererPolicy.status === "verified" &&
      randomization.status === "verified" &&
      raterAttestation.status === "verified" &&
      evaluatorEvidence.status === "verified",
  };
}

function metricSeed(seed, label) {
  return createHash("sha256").update(`${seed}:${label}`).digest().readUInt32LE(0) || 1;
}

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function bootstrapMean(values, label, confidence) {
  if (values === null || values.length === 0 || values.some((value) => !Number.isFinite(value))) {
    return null;
  }
  const random = randomGenerator(metricSeed(confidence.seed, label));
  const means = new Array(confidence.samples);
  for (let sample = 0; sample < confidence.samples; sample += 1) {
    let total = 0;
    for (let index = 0; index < values.length; index += 1) {
      total += values[Math.floor(random() * values.length)];
    }
    means[sample] = total / values.length;
  }
  means.sort((left, right) => left - right);
  const lowerIndex = Math.floor((1 - confidence.confidenceLevel) * (means.length - 1));
  const upperIndex = Math.floor(confidence.confidenceLevel * (means.length - 1));
  const estimate = values.reduce((total, value) => total + value, 0) / values.length;
  return {
    estimate,
    lowerBound: means[lowerIndex],
    upperBound: means[upperIndex],
    confidenceLevel: confidence.confidenceLevel,
    workloadPairs: values.length,
  };
}

function roundedStatistic(statistic) {
  return statistic === null
    ? null
    : Object.fromEntries(
        Object.entries(statistic).map(([key, value]) => [
          key,
          typeof value === "number" ? rounded(value) : value,
        ]),
      );
}

function wilsonInterval(successes, total, z) {
  if (!Number.isInteger(successes) || !Number.isInteger(total) || total <= 0) return null;
  const rate = successes / total;
  const zSquared = z * z;
  const denominator = 1 + zSquared / total;
  const center = (rate + zSquared / (2 * total)) / denominator;
  const halfWidth =
    (z * Math.sqrt((rate * (1 - rate)) / total + zSquared / (4 * total * total))) /
    denominator;
  return { lowerBound: center - halfWidth, upperBound: center + halfWidth };
}

function conservativeRecognitionRate(workloadBootstrap, ux, armId) {
  if (workloadBootstrap === null) return null;
  const workloadWilsonLowerBound = Math.min(
    ...ux.map((row) =>
      wilsonInterval(row.personaIdentification[armId].correct, row.raters, ONE_SIDED_95_Z)
        .lowerBound,
    ),
  );
  return {
    ...workloadBootstrap,
    lowerBound: Math.min(workloadBootstrap.lowerBound, workloadWilsonLowerBound),
    workloadBootstrapLowerBound: workloadBootstrap.lowerBound,
    minimumWorkloadWilsonLowerBound: workloadWilsonLowerBound,
    lowerBoundMethod: "minimum-of-workload-bootstrap-and-per-workload-one-sided-wilson",
  };
}

function conservativeRecognitionLift(workloadBootstrap, ux) {
  if (workloadBootstrap === null) return null;
  const minimumWorkloadNewcombeLowerBound = Math.min(
    ...ux.map((row) => {
      const voiceWilson = wilsonInterval(
        row.personaIdentification.voice.correct,
        row.raters,
        SIMULTANEOUS_95_Z,
      );
      const controlWilson = wilsonInterval(
        row.personaIdentification.control.correct,
        row.raters,
        SIMULTANEOUS_95_Z,
      );
      return voiceWilson.lowerBound - controlWilson.upperBound;
    }),
  );
  return {
    ...workloadBootstrap,
    lowerBound: Math.min(workloadBootstrap.lowerBound, minimumWorkloadNewcombeLowerBound),
    workloadBootstrapLowerBound: workloadBootstrap.lowerBound,
    minimumWorkloadNewcombeLowerBound,
    lowerBoundMethod: "minimum-of-workload-bootstrap-and-per-workload-newcombe-wilson",
  };
}

function completeMetric(rows, key, expectedCount = rows.length) {
  const values = rows.map((row) => row[key]);
  return values.length === expectedCount && values.every((value) => Number.isFinite(value))
    ? values
    : null;
}

function upperAtMost(statistic, threshold) {
  return statistic === null ? null : statistic.upperBound <= threshold;
}

function lowerAtLeast(statistic, threshold) {
  return statistic === null ? null : statistic.lowerBound >= threshold;
}

export function summarizePersonaLayerBenchmarkResult(value, options = {}) {
  const result = validatePersonaLayerBenchmarkResult(value);
  const criticalSafetyFailures = [];
  const comparisons = result.workloads.map((workload) => {
    for (const [armId, arm] of Object.entries(workload.arms)) {
      for (const failure of arm.safety.criticalFailures) {
        criticalSafetyFailures.push({
          workloadId: workload.id,
          armId,
          id: failure.id,
          description: failure.description,
        });
      }
    }
    const control = workload.arms.control;
    const voice = workload.arms["control-voice"];
    const taskVoice = workload.arms["task-voice"];
    const controlTotals = armTotals(control);
    const voiceTotals = armTotals(voice);
    const taskTotals = armTotals(taskVoice);
    const voiceQualityDelta =
      control.taskQuality && voice.taskQuality
        ? voice.taskQuality.score - control.taskQuality.score
        : null;
    const taskQualityDeltaVsControlVoice =
      voice.taskQuality && taskVoice.taskQuality
        ? taskVoice.taskQuality.score - voice.taskQuality.score
        : null;
    return {
      workloadId: workload.id,
      fixtureId: workload.fixtureId,
      alignment: workload.alignment,
      taskModeCompatible: workload.taskModeCompatible,
      voiceTokenRatio: ratio(voiceTotals.tokens, controlTotals.tokens),
      voiceTimeRatio: ratio(voiceTotals.elapsedSeconds, controlTotals.elapsedSeconds),
      voiceQualityDelta,
      taskVsControlVoiceTokenRatio: workload.taskModeCompatible
        ? ratio(taskTotals.tokens, voiceTotals.tokens)
        : null,
      taskVsControlVoiceTimeRatio: workload.taskModeCompatible
        ? ratio(taskTotals.elapsedSeconds, voiceTotals.elapsedSeconds)
        : null,
      taskQualityDeltaVsControlVoice: workload.taskModeCompatible
        ? taskQualityDeltaVsControlVoice
        : null,
      fullProductTokenRatioVsControl: ratio(taskTotals.tokens, controlTotals.tokens),
      fullProductTimeRatioVsControl: ratio(taskTotals.elapsedSeconds, controlTotals.elapsedSeconds),
      fullProductQualityDeltaVsControl:
        control.taskQuality && taskVoice.taskQuality
          ? taskVoice.taskQuality.score - control.taskQuality.score
          : null,
    };
  });

  const compatibleComparisons = comparisons.filter((item) => item.taskModeCompatible);
  const uxRows = result.ux.map((ux) => {
    const controlRecognitionRate = ux.personaIdentification.control.correct / ux.raters;
    const voiceRecognitionRate = ux.personaIdentification.voice.correct / ux.raters;
    return {
      workloadId: ux.workloadId,
      raters: ux.raters,
      preferenceScore: (ux.preference.voice + ux.preference.tie * 0.5) / ux.raters,
      controlRecognitionRate,
      voiceRecognitionRate,
      voiceRecognitionLift: voiceRecognitionRate - controlRecognitionRate,
      clarityDelta: ux.clarity.voice - ux.clarity.control,
      trustDelta: ux.trust.voice - ux.trust.control,
      perceivedEffortImprovement: ux.perceivedEffort.control - ux.perceivedEffort.voice,
      intentToReuseDelta: ux.intentToReuse.voice - ux.intentToReuse.control,
    };
  });
  const confidence = result.protocol.confidence;
  const bounds = {
    voiceTokenRatio: bootstrapMean(
      completeMetric(comparisons, "voiceTokenRatio"),
      "voice-token-ratio",
      confidence,
    ),
    voiceTimeRatio: bootstrapMean(
      completeMetric(comparisons, "voiceTimeRatio"),
      "voice-time-ratio",
      confidence,
    ),
    voiceQualityDelta: bootstrapMean(
      completeMetric(comparisons, "voiceQualityDelta"),
      "voice-quality-delta",
      confidence,
    ),
    taskVsControlVoiceTokenRatio: bootstrapMean(
      completeMetric(compatibleComparisons, "taskVsControlVoiceTokenRatio"),
      "task-vs-control-voice-token-ratio",
      confidence,
    ),
    taskVsControlVoiceTimeRatio: bootstrapMean(
      completeMetric(compatibleComparisons, "taskVsControlVoiceTimeRatio"),
      "task-vs-control-voice-time-ratio",
      confidence,
    ),
    taskQualityDeltaVsControlVoice: bootstrapMean(
      completeMetric(compatibleComparisons, "taskQualityDeltaVsControlVoice"),
      "task-quality-delta-vs-control-voice",
      confidence,
    ),
    voicePreferenceScore: bootstrapMean(
      completeMetric(uxRows, "preferenceScore"),
      "voice-preference-score",
      confidence,
    ),
    controlRecognitionRate: bootstrapMean(
      completeMetric(uxRows, "controlRecognitionRate"),
      "control-recognition-rate",
      confidence,
    ),
    voiceRecognitionRate: bootstrapMean(
      completeMetric(uxRows, "voiceRecognitionRate"),
      "voice-recognition-rate",
      confidence,
    ),
    voiceRecognitionLift: bootstrapMean(
      completeMetric(uxRows, "voiceRecognitionLift"),
      "voice-recognition-lift",
      confidence,
    ),
    clarityDelta: bootstrapMean(
      completeMetric(uxRows, "clarityDelta"),
      "clarity-delta",
      confidence,
    ),
    trustDelta: bootstrapMean(
      completeMetric(uxRows, "trustDelta"),
      "trust-delta",
      confidence,
    ),
    perceivedEffortImprovement: bootstrapMean(
      completeMetric(uxRows, "perceivedEffortImprovement"),
      "perceived-effort-improvement",
      confidence,
    ),
    intentToReuseDelta: bootstrapMean(
      completeMetric(uxRows, "intentToReuseDelta"),
      "intent-to-reuse-delta",
      confidence,
    ),
  };
  bounds.controlRecognitionRate = conservativeRecognitionRate(
    bounds.controlRecognitionRate,
    result.ux,
    "control",
  );
  bounds.voiceRecognitionRate = conservativeRecognitionRate(
    bounds.voiceRecognitionRate,
    result.ux,
    "voice",
  );
  bounds.voiceRecognitionLift = conservativeRecognitionLift(
    bounds.voiceRecognitionLift,
    result.ux,
  );

  const decisionChecks = {
    voiceTokenBudget: upperAtMost(bounds.voiceTokenRatio, result.protocol.tokenBudgetRatio),
    voiceTimeBudget: upperAtMost(bounds.voiceTimeRatio, result.protocol.timeBudgetRatio),
    voiceQualityNonInferiority: lowerAtLeast(
      bounds.voiceQualityDelta,
      -result.protocol.nonInferiorityMargin,
    ),
    taskTokenBudgetVsControlVoice: upperAtMost(
      bounds.taskVsControlVoiceTokenRatio,
      result.protocol.taskTokenBudgetRatio,
    ),
    taskTimeBudgetVsControlVoice: upperAtMost(
      bounds.taskVsControlVoiceTimeRatio,
      result.protocol.taskTimeBudgetRatio,
    ),
    taskQualityMinimumDeltaVsControlVoice: lowerAtLeast(
      bounds.taskQualityDeltaVsControlVoice,
      result.protocol.taskQualityMinimumDelta,
    ),
    voicePreference: lowerAtLeast(
      bounds.voicePreferenceScore,
      result.protocol.ux.preferenceScoreMinimum,
    ),
    voiceRecognitionRate: lowerAtLeast(
      bounds.voiceRecognitionRate,
      result.protocol.ux.voiceRecognitionRateMinimum,
    ),
    voiceRecognitionLift: lowerAtLeast(
      bounds.voiceRecognitionLift,
      result.protocol.ux.voiceRecognitionLiftMinimum,
    ),
    clarityNonInferiority: lowerAtLeast(
      bounds.clarityDelta,
      -result.protocol.ux.secondaryNonInferiorityMargin,
    ),
    trustNonInferiority: lowerAtLeast(
      bounds.trustDelta,
      -result.protocol.ux.secondaryNonInferiorityMargin,
    ),
    perceivedEffortNonInferiority: lowerAtLeast(
      bounds.perceivedEffortImprovement,
      -result.protocol.ux.secondaryNonInferiorityMargin,
    ),
    intentToReuseNonInferiority: lowerAtLeast(
      bounds.intentToReuseDelta,
      -result.protocol.ux.secondaryNonInferiorityMargin,
    ),
  };

  const totalRaters = result.ux.reduce((total, ux) => total + ux.raters, 0);
  const minimumObservedRaters = Math.min(...result.ux.map((ux) => ux.raters));
  const evidenceGuardrails = {
    workloadPairs: new Set(result.workloads.map((workload) => workload.fixtureSha256)).size,
    minimumWorkloadPairs: confidence.minimumWorkloadPairs,
    compatibleTaskPairs: new Set(
      result.workloads
        .filter((workload) => workload.taskModeCompatible)
        .map((workload) => workload.fixtureSha256),
    ).size,
    minimumCompatibleTaskPairs: confidence.minimumCompatibleTaskPairs,
    minimumObservedRatersPerWorkload: minimumObservedRaters,
    minimumRatersPerWorkload: confidence.minimumRatersPerWorkload,
    totalRaters,
    minimumTotalRaters: confidence.minimumTotalRaters,
  };
  evidenceGuardrails.sufficient =
    evidenceGuardrails.workloadPairs >= evidenceGuardrails.minimumWorkloadPairs &&
    evidenceGuardrails.compatibleTaskPairs >= evidenceGuardrails.minimumCompatibleTaskPairs &&
    evidenceGuardrails.minimumObservedRatersPerWorkload >= evidenceGuardrails.minimumRatersPerWorkload &&
    evidenceGuardrails.totalRaters >= evidenceGuardrails.minimumTotalRaters;

  const provenance = privateEvidenceStatus(result, options);
  const provenanceFailure = [
    provenance.commit.status,
    provenance.rendererPolicy.status,
    provenance.randomizationMapping.status,
    provenance.raterAttestation.status,
    provenance.evaluatorEvidence.status,
  ].some((status) => status === "mismatch" || status === "invalid");

  const requiredChecks = Object.values(decisionChecks);
  const releaseGate =
    criticalSafetyFailures.length > result.protocol.criticalSafetyThreshold ||
    requiredChecks.includes(false) ||
    provenanceFailure
      ? "fail"
      : result.runKind !== "confirmatory" ||
          !evidenceGuardrails.sufficient ||
          requiredChecks.includes(null) ||
          !provenance.verified
        ? "inconclusive"
        : "pass";

  return {
    schemaVersion: 2,
    id: result.id,
    runKind: result.runKind,
    persona: result.persona,
    comparisons: comparisons.map((comparison) =>
      Object.fromEntries(
        Object.entries(comparison).map(([key, item]) => [
          key,
          typeof item === "number" ? rounded(item) : item,
        ]),
      ),
    ),
    confidence: {
      method: confidence.method,
      confidenceLevel: confidence.confidenceLevel,
      seed: confidence.seed,
      samples: confidence.samples,
      bounds: Object.fromEntries(
        Object.entries(bounds).map(([key, statistic]) => [key, roundedStatistic(statistic)]),
      ),
    },
    decisionChecks,
    evidenceGuardrails,
    provenance,
    criticalSafetyFailures,
    criticalSafetyFailureCount: criticalSafetyFailures.length,
    releaseGate,
  };
}

export function renderPersonaLayerBenchmarkMarkdown(result, summary, sourceName = "result-v2.json") {
  const rows = summary.comparisons
    .map(
      (item) =>
        `| ${item.workloadId} | ${item.alignment} | ${item.voiceTokenRatio ?? "n/a"}x | ${item.voiceTimeRatio ?? "n/a"}x | ${item.voiceQualityDelta ?? "n/a"} | ${item.taskVsControlVoiceTokenRatio ?? "n/a"}x | ${item.taskVsControlVoiceTimeRatio ?? "n/a"}x | ${item.taskQualityDeltaVsControlVoice ?? "n/a"} |`,
    )
    .join("\n");
  const safetyDetails = summary.criticalSafetyFailures.length === 0
    ? "- None."
    : summary.criticalSafetyFailures
        .map(
          (failure) =>
            `- \`${failure.workloadId}/${failure.armId}/${failure.id}\`: ${failure.description}`,
        )
        .join("\n");
  const preference = summary.confidence.bounds.voicePreferenceScore;
  const recognition = summary.confidence.bounds.voiceRecognitionRate;
  const recognitionLift = summary.confidence.bounds.voiceRecognitionLift;
  return `# Persona layer benchmark: ${result.persona.id}\n\n` +
    `Source: \`${sourceName}\`  \n` +
    `Run kind: \`${result.runKind}\`  \n` +
    `Design: five-arm solver/renderer crossover; human UX ratings\n\n` +
    `| Workload | Alignment | Voice tokens | Voice time | Voice quality delta | Task/Control+Voice tokens | Task/Control+Voice time | Task quality delta |\n` +
    `| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |\n${rows}\n\n` +
    `Voice preference bootstrap estimate: **${preference?.estimate ?? "n/a"}**; ` +
    `one-sided 95% lower bound: **${preference?.lowerBound ?? "n/a"}**.  \n` +
    `Voice recognition estimate: **${recognition?.estimate ?? "n/a"}**; ` +
    `conservative one-sided 95% lower bound: **${recognition?.lowerBound ?? "n/a"}**.  \n` +
    `Voice recognition lift over control: **${recognitionLift?.estimate ?? "n/a"}**; ` +
    `conservative one-sided 95% lower bound: **${recognitionLift?.lowerBound ?? "n/a"}**.  \n` +
    `Evidence guardrails: **${summary.evidenceGuardrails.sufficient ? "sufficient" : "insufficient"}**.  \n` +
    `Renderer policy expected from checkout: \`${summary.provenance.rendererPolicy.expectedSha256 ?? "unavailable"}\`; result: \`${summary.provenance.rendererPolicy.actualSha256}\` (**${summary.provenance.rendererPolicy.status}**).  \n` +
    `Private evidence binding: **${summary.provenance.verified ? "verified" : "not verified"}**.  \n` +
    `Critical safety failures: **${summary.criticalSafetyFailureCount}** (required: 0).\n\n` +
    `${safetyDetails}\n\n` +
    `Release gate: **${summary.releaseGate.toUpperCase()}**.\n\n` +
    `Only exact-commit confirmatory runs with verified private evidence can pass. Recognition bounds conservatively combine workload bootstrap with the weakest per-workload Wilson/Newcombe bound.\n`;
}

export function parsePersonaLayerBenchmarkCliArgs(args, env = process.env) {
  let json = false;
  let gate = false;
  let help = false;
  let expectedCommit = null;
  let randomizationMappingPath = null;
  let raterAttestationPath = null;
  let evaluatorEvidencePath = null;
  const paths = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") continue;
    if (argument === "--json") json = true;
    else if (argument === "--gate") gate = true;
    else if (argument === "--help" || argument === "-h") help = true;
    else if (argument === "--expected-commit") {
      expectedCommit = args[index + 1] ?? null;
      index += 1;
    } else if (argument.startsWith("--expected-commit=")) {
      expectedCommit = argument.slice("--expected-commit=".length);
    } else if (argument === "--randomization-mapping") {
      randomizationMappingPath = args[index + 1] ?? null;
      index += 1;
    } else if (argument.startsWith("--randomization-mapping=")) {
      randomizationMappingPath = argument.slice("--randomization-mapping=".length);
    } else if (argument === "--rater-attestation") {
      raterAttestationPath = args[index + 1] ?? null;
      index += 1;
    } else if (argument.startsWith("--rater-attestation=")) {
      raterAttestationPath = argument.slice("--rater-attestation=".length);
    } else if (argument === "--evaluator-evidence") {
      evaluatorEvidencePath = args[index + 1] ?? null;
      index += 1;
    } else if (argument.startsWith("--evaluator-evidence=")) {
      evaluatorEvidencePath = argument.slice("--evaluator-evidence=".length);
    }
    else if (argument.startsWith("-")) throw new Error(`Unknown option: ${argument}`);
    else paths.push(argument);
  }
  if (paths.length > 1) throw new Error("Expected at most one result path.");
  const requestedPath = paths[0] ?? env.PERSONA_LAYER_BENCHMARK_RESULT ?? null;
  expectedCommit ??= env.PERSONA_BENCHMARK_EXPECTED_COMMIT ?? env.GITHUB_SHA ?? null;
  randomizationMappingPath ??= env.PERSONA_BENCHMARK_RANDOMIZATION_MAPPING_PATH ?? null;
  raterAttestationPath ??= env.PERSONA_BENCHMARK_RATER_ATTESTATION_PATH ?? null;
  evaluatorEvidencePath ??= env.PERSONA_BENCHMARK_EVALUATOR_EVIDENCE_PATH ?? null;
  if (!help && !requestedPath) throw new Error(PERSONA_LAYER_BENCHMARK_USAGE);
  if (expectedCommit !== null && !GIT_SHA.test(expectedCommit)) {
    throw new Error("--expected-commit must be a 40-character lowercase Git SHA.");
  }
  if (
    !help &&
    gate &&
    (expectedCommit === null ||
      randomizationMappingPath === null ||
      raterAttestationPath === null ||
      evaluatorEvidencePath === null)
  ) {
    throw new Error(
      "--gate requires an exact expected commit, a private randomization mapping, a private rater attestation, and private evaluator evidence.",
    );
  }
  return {
    json,
    gate,
    help,
    requestedPath,
    expectedCommit,
    randomizationMappingPath,
    raterAttestationPath,
    evaluatorEvidencePath,
  };
}

async function runCli(args) {
  const options = parsePersonaLayerBenchmarkCliArgs(args);
  if (options.help) {
    process.stdout.write(`${PERSONA_LAYER_BENCHMARK_USAGE}\n`);
    return;
  }
  const inputPath = resolve(options.requestedPath);
  const result = JSON.parse(await readFile(inputPath, "utf8"));
  const [randomizationMappingContents, raterAttestationContents, evaluatorEvidenceContents] = await Promise.all([
    options.randomizationMappingPath === null
      ? null
      : readFile(resolve(options.randomizationMappingPath)),
    options.raterAttestationPath === null
      ? null
      : readFile(resolve(options.raterAttestationPath)),
    options.evaluatorEvidencePath === null
      ? null
      : readFile(resolve(options.evaluatorEvidencePath)),
  ]);
  const summary = summarizePersonaLayerBenchmarkResult(result, {
    expectedCommit: options.expectedCommit,
    randomizationMappingContents,
    raterAttestationContents,
    evaluatorEvidenceContents,
  });
  process.stdout.write(
    options.json
      ? `${JSON.stringify(summary, null, 2)}\n`
      : renderPersonaLayerBenchmarkMarkdown(result, summary, basename(inputPath)),
  );
  if (options.gate && summary.releaseGate !== "pass") process.exitCode = 1;
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  runCli(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
