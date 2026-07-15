import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ARM_STATUSES = new Set(["complete", "failed", "blocked", "excluded"]);
const RUN_KINDS = new Set(["protocol-validation", "pilot", "screening", "confirmatory"]);
const LOCALES = new Set(["en", "ru"]);
const INTENSITIES = new Set(["subtle", "balanced", "immersive"]);
const FORMATS = new Set(["text", "markdown", "json"]);
const TIMING_MODES = new Set(["concurrent-shared-resources", "counterbalanced-sequential"]);
const LAUNCH_ORDERS = new Set(["simultaneous", "control-first", "persona-first"]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export const PERSONA_OVERHEAD_USAGE =
  "Usage: pnpm benchmark:persona-overhead -- <result.json> [--json] " +
  "or set PERSONA_OVERHEAD_RESULT.";

function requireObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value;
}

function requireExactKeys(value, label, allowedKeys) {
  const unexpected = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unexpected.length > 0) {
    throw new TypeError(`${label} contains unexpected keys: ${unexpected.join(", ")}.`);
  }
  const missing = [...allowedKeys].filter((key) => !Object.hasOwn(value, key));
  if (missing.length > 0) {
    throw new TypeError(`${label} is missing required keys: ${missing.join(", ")}.`);
  }
  return value;
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  return value;
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") {
    throw new TypeError(`${label} must be a boolean.`);
  }
  return value;
}

function requirePattern(value, label, pattern) {
  const text = requireString(value, label);
  if (!pattern.test(text)) {
    throw new TypeError(`${label} has an invalid format.`);
  }
  return text;
}

function requireEnum(value, label, allowed) {
  if (!allowed.has(value)) {
    throw new TypeError(`${label} must be one of: ${[...allowed].join(", ")}.`);
  }
  return value;
}

function requireNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative integer.`);
  }
  return value;
}

function requirePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer.`);
  }
  return value;
}

function optionalNonNegativeInteger(value, label) {
  if (value === null || value === undefined) return null;
  return requireNonNegativeInteger(value, label);
}

function optionalPositiveNumber(value, label) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} must be null or a positive finite number.`);
  }
  return value;
}

function optionalScore(value, label) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new TypeError(`${label} must be null or a number from 0 to 100.`);
  }
  return value;
}

function optionalString(value, label) {
  if (value === null || value === undefined) return null;
  return requireString(value, label);
}

function optionalPattern(value, label, pattern) {
  if (value === null || value === undefined) return null;
  return requirePattern(value, label, pattern);
}

function requireIdArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty array.`);
  }
  const ids = value.map((entry, index) =>
    requirePattern(entry, `${label}[${index}]`, ID_PATTERN),
  );
  if (new Set(ids).size !== ids.length) {
    throw new TypeError(`${label} must not contain duplicate step ids.`);
  }
  return ids;
}

function optionalFailureReason(value, label, status) {
  if (status === "complete") {
    if (value !== null && value !== undefined) {
      throw new TypeError(`${label} must be null for a complete arm.`);
    }
    return null;
  }
  return requireString(value, label);
}

function validateQualityBreakdown(value, label, score, rubric) {
  if (score === null) {
    if (value !== null && value !== undefined) {
      throw new TypeError(`${label} must be null when taskQualityScore is null.`);
    }
    return null;
  }

  const breakdown = requireObject(value, label);
  requireExactKeys(breakdown, label, new Set(rubric.map((component) => component.id)));
  let total = 0;
  for (const component of rubric) {
    const componentScore = breakdown[component.id];
    if (
      typeof componentScore !== "number" ||
      !Number.isFinite(componentScore) ||
      componentScore < 0 ||
      componentScore > component.maximum
    ) {
      throw new TypeError(
        `${label}.${component.id} must be between 0 and ${component.maximum}.`,
      );
    }
    total += componentScore;
  }
  if (Math.abs(total - score) > 1e-9) {
    throw new TypeError(`${label} must sum to taskQualityScore.`);
  }
  return breakdown;
}

function round(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function validateArm(
  value,
  label,
  scheduledStepIds,
  roundArtifactsRetained,
  actualModelRequestsAvailable,
) {
  const arm = requireObject(value, label);
  requireExactKeys(
    arm,
    label,
    new Set([
      "status",
      "executedStepIds",
      "roundArtifactSha256",
      "tokens",
      "elapsedSeconds",
      "modelRequests",
      "taskQualityScore",
      "taskQualityBreakdown",
      "processErrors",
      "selfCorrections",
      "failureReason",
    ]),
  );
  const status = requireEnum(arm.status, `${label}.status`, ARM_STATUSES);
  if (!Array.isArray(arm.executedStepIds)) {
    throw new TypeError(`${label}.executedStepIds must be an array.`);
  }
  const executedStepIds = arm.executedStepIds.map((entry, index) =>
    requirePattern(entry, `${label}.executedStepIds[${index}]`, ID_PATTERN),
  );
  const expectedPrefix = scheduledStepIds.slice(0, executedStepIds.length);
  if (
    executedStepIds.length > scheduledStepIds.length ||
    executedStepIds.some((entry, index) => entry !== expectedPrefix[index])
  ) {
    throw new TypeError(`${label}.executedStepIds must be an ordered workload prefix.`);
  }
  const executedSteps = executedStepIds.length;
  const roundArtifactSha256 = optionalPattern(
    arm.roundArtifactSha256,
    `${label}.roundArtifactSha256`,
    SHA256_PATTERN,
  );
  if (roundArtifactsRetained && roundArtifactSha256 === null) {
    throw new TypeError(`${label}.roundArtifactSha256 is required when artifacts are retained.`);
  }
  if (!roundArtifactsRetained && roundArtifactSha256 !== null) {
    throw new TypeError(`${label}.roundArtifactSha256 must be null when artifacts are not retained.`);
  }

  const tokens = optionalPositiveNumber(arm.tokens, `${label}.tokens`);
  const elapsedSeconds = optionalPositiveNumber(arm.elapsedSeconds, `${label}.elapsedSeconds`);
  const modelRequests = optionalNonNegativeInteger(
    arm.modelRequests,
    `${label}.modelRequests`,
  );
  if (actualModelRequestsAvailable && modelRequests === null) {
    throw new TypeError(`${label}.modelRequests is required when request counts are available.`);
  }
  if (!actualModelRequestsAvailable && modelRequests !== null) {
    throw new TypeError(`${label}.modelRequests must be null when request counts are unavailable.`);
  }
  if (status === "complete") {
    if (executedSteps !== scheduledStepIds.length) {
      throw new TypeError(`${label}.executedStepIds must include every scheduled step when complete.`);
    }
    if (tokens === null || elapsedSeconds === null) {
      throw new TypeError(`${label} must include token and elapsed metrics when complete.`);
    }
    if (actualModelRequestsAvailable && modelRequests === 0) {
      throw new TypeError(`${label}.modelRequests must be positive when complete.`);
    }
  }

  return {
    status,
    executedSteps,
    executedStepIds,
    roundArtifactSha256,
    tokens,
    elapsedSeconds,
    modelRequests,
    taskQualityScore: optionalScore(arm.taskQualityScore, `${label}.taskQualityScore`),
    taskQualityBreakdown: arm.taskQualityBreakdown,
    processErrors: requireNonNegativeInteger(arm.processErrors, `${label}.processErrors`),
    selfCorrections: requireNonNegativeInteger(arm.selfCorrections, `${label}.selfCorrections`),
    failureReason: optionalFailureReason(arm.failureReason, `${label}.failureReason`, status),
  };
}

export function validatePersonaOverheadResult(value) {
  const result = requireObject(value, "result");
  requireExactKeys(
    result,
    "result",
    new Set([
      "schemaVersion",
      "id",
      "runKind",
      "commit",
      "workload",
      "runtime",
      "persona",
      "arms",
      "quality",
    ]),
  );
  if (result.schemaVersion !== 1) {
    throw new TypeError("result.schemaVersion must equal 1.");
  }

  requirePattern(result.id, "result.id", ID_PATTERN);
  requireEnum(result.runKind, "result.runKind", RUN_KINDS);
  requirePattern(result.commit, "result.commit", COMMIT_PATTERN);

  const workload = requireObject(result.workload, "result.workload");
  requireExactKeys(
    workload,
    "result.workload",
    new Set([
      "id",
      "scheduledSteps",
      "scheduledStepIds",
      "controlPayloadSha256",
      "personaPayloadSha256",
      "effectiveInstructionsSha256",
      "roundArtifactsRetained",
    ]),
  );
  requirePattern(workload.id, "result.workload.id", ID_PATTERN);
  const scheduledSteps = requirePositiveInteger(
    workload.scheduledSteps,
    "result.workload.scheduledSteps",
  );
  const scheduledStepIds = requireIdArray(
    workload.scheduledStepIds,
    "result.workload.scheduledStepIds",
  );
  if (scheduledStepIds.length !== scheduledSteps) {
    throw new TypeError("result.workload.scheduledStepIds length must equal scheduledSteps.");
  }
  const controlPayloadSha256 = requirePattern(
    workload.controlPayloadSha256,
    "result.workload.controlPayloadSha256",
    SHA256_PATTERN,
  );
  const personaPayloadSha256 = requirePattern(
    workload.personaPayloadSha256,
    "result.workload.personaPayloadSha256",
    SHA256_PATTERN,
  );
  requirePattern(
    workload.effectiveInstructionsSha256,
    "result.workload.effectiveInstructionsSha256",
    SHA256_PATTERN,
  );
  const roundArtifactsRetained = requireBoolean(
    workload.roundArtifactsRetained,
    "result.workload.roundArtifactsRetained",
  );
  if (controlPayloadSha256 === personaPayloadSha256) {
    throw new TypeError("Control and persona payload hashes must differ.");
  }
  if (result.runKind === "confirmatory" && workload.roundArtifactsRetained !== true) {
    throw new TypeError("Confirmatory runs must retain round artifacts.");
  }

  const runtime = requireObject(result.runtime, "result.runtime");
  requireExactKeys(
    runtime,
    "result.runtime",
    new Set([
      "surface",
      "model",
      "modelConfigurationSha256",
      "toolPolicySha256",
      "sameConfigurationAcrossArms",
      "timingMode",
      "launchOrder",
      "actualModelRequestsAvailable",
    ]),
  );
  requireString(runtime.surface, "result.runtime.surface");
  requireString(runtime.model, "result.runtime.model");
  requirePattern(
    runtime.modelConfigurationSha256,
    "result.runtime.modelConfigurationSha256",
    SHA256_PATTERN,
  );
  requirePattern(runtime.toolPolicySha256, "result.runtime.toolPolicySha256", SHA256_PATTERN);
  requireBoolean(
    runtime.sameConfigurationAcrossArms,
    "result.runtime.sameConfigurationAcrossArms",
  );
  requireEnum(runtime.timingMode, "result.runtime.timingMode", TIMING_MODES);
  requireEnum(runtime.launchOrder, "result.runtime.launchOrder", LAUNCH_ORDERS);
  const actualModelRequestsAvailable = requireBoolean(
    runtime.actualModelRequestsAvailable,
    "result.runtime.actualModelRequestsAvailable",
  );

  const persona = requireObject(result.persona, "result.persona");
  requireExactKeys(
    persona,
    "result.persona",
    new Set([
      "id",
      "locale",
      "intensity",
      "format",
      "compiledPromptSha256",
      "compiledPromptBytes",
    ]),
  );
  requirePattern(persona.id, "result.persona.id", ID_PATTERN);
  requireEnum(persona.locale, "result.persona.locale", LOCALES);
  requireEnum(persona.intensity, "result.persona.intensity", INTENSITIES);
  requireEnum(persona.format, "result.persona.format", FORMATS);
  requirePattern(persona.compiledPromptSha256, "result.persona.compiledPromptSha256", SHA256_PATTERN);
  requirePositiveInteger(persona.compiledPromptBytes, "result.persona.compiledPromptBytes");

  const arms = requireObject(result.arms, "result.arms");
  requireExactKeys(arms, "result.arms", new Set(["control", "persona"]));
  const control = validateArm(
    arms.control,
    "result.arms.control",
    scheduledStepIds,
    roundArtifactsRetained,
    actualModelRequestsAvailable,
  );
  const treatment = validateArm(
    arms.persona,
    "result.arms.persona",
    scheduledStepIds,
    roundArtifactsRetained,
    actualModelRequestsAvailable,
  );

  const quality = requireObject(result.quality, "result.quality");
  requireExactKeys(
    quality,
    "result.quality",
    new Set([
      "labelBlinded",
      "rubricMaximum",
      "rubric",
      "nonInferiorityMargin",
      "evaluatorModel",
      "evaluatorPayloadSha256",
      "artifactSha256",
      "armMappingSha256",
    ]),
  );
  const labelBlinded = requireBoolean(
    quality.labelBlinded,
    "result.quality.labelBlinded",
  );
  if (quality.rubricMaximum !== 100) {
    throw new TypeError("result.quality.rubricMaximum must equal 100.");
  }
  if (!Array.isArray(quality.rubric) || quality.rubric.length === 0) {
    throw new TypeError("result.quality.rubric must be a non-empty array.");
  }
  const rubricIds = new Set();
  const rubric = quality.rubric.map((entry, index) => {
    const label = `result.quality.rubric[${index}]`;
    const component = requireObject(entry, label);
    requireExactKeys(component, label, new Set(["id", "maximum"]));
    const id = requirePattern(component.id, `${label}.id`, ID_PATTERN);
    if (rubricIds.has(id)) {
      throw new TypeError(`result.quality.rubric contains duplicate id: ${id}.`);
    }
    rubricIds.add(id);
    return {
      id,
      maximum: requirePositiveInteger(component.maximum, `${label}.maximum`),
    };
  });
  const rubricTotal = rubric.reduce((total, component) => total + component.maximum, 0);
  if (rubricTotal !== quality.rubricMaximum) {
    throw new TypeError("result.quality.rubric maxima must sum to rubricMaximum.");
  }
  const nonInferiorityMargin = optionalScore(
    quality.nonInferiorityMargin,
    "result.quality.nonInferiorityMargin",
  );
  if (nonInferiorityMargin === null) {
    throw new TypeError("result.quality.nonInferiorityMargin is required.");
  }
  const evaluatorModel = optionalString(
    quality.evaluatorModel,
    "result.quality.evaluatorModel",
  );
  const evaluatorPayloadSha256 = optionalPattern(
    quality.evaluatorPayloadSha256,
    "result.quality.evaluatorPayloadSha256",
    SHA256_PATTERN,
  );
  const qualityArtifactSha256 = optionalPattern(
    quality.artifactSha256,
    "result.quality.artifactSha256",
    SHA256_PATTERN,
  );
  const armMappingSha256 = optionalPattern(
    quality.armMappingSha256,
    "result.quality.armMappingSha256",
    SHA256_PATTERN,
  );
  if (
    (control.taskQualityScore !== null || treatment.taskQualityScore !== null) &&
    (evaluatorModel === null ||
      evaluatorPayloadSha256 === null ||
      qualityArtifactSha256 === null ||
      armMappingSha256 === null)
  ) {
    throw new TypeError(
      "Scored arms require evaluatorModel and evaluator, output, and mapping hashes.",
    );
  }
  control.taskQualityBreakdown = validateQualityBreakdown(
    control.taskQualityBreakdown,
    "result.arms.control.taskQualityBreakdown",
    control.taskQualityScore,
    rubric,
  );
  treatment.taskQualityBreakdown = validateQualityBreakdown(
    treatment.taskQualityBreakdown,
    "result.arms.persona.taskQualityBreakdown",
    treatment.taskQualityScore,
    rubric,
  );

  return {
    result,
    scheduledSteps,
    control,
    persona: treatment,
    nonInferiorityMargin,
    sameConfigurationAcrossArms: runtime.sameConfigurationAcrossArms,
    labelBlinded,
  };
}

export function summarizePersonaOverheadResult(value) {
  const validated = validatePersonaOverheadResult(value);
  const { control, persona, scheduledSteps } = validated;
  const comparable =
    validated.sameConfigurationAcrossArms === true &&
    control.status === "complete" &&
    persona.status === "complete" &&
    control.tokens !== null &&
    persona.tokens !== null &&
    control.elapsedSeconds !== null &&
    persona.elapsedSeconds !== null;
  const qualityComparable =
    comparable && control.taskQualityScore !== null && persona.taskQualityScore !== null;
  const requestComparable =
    comparable && control.modelRequests !== null && persona.modelRequests !== null;

  return {
    comparable,
    scheduledSteps,
    control,
    persona,
    tokenDelta: comparable ? persona.tokens - control.tokens : null,
    tokenOverheadPercent: comparable
      ? round(((persona.tokens - control.tokens) / control.tokens) * 100)
      : null,
    tokenRatio: comparable ? round(persona.tokens / control.tokens, 3) : null,
    modelRequestDelta: requestComparable
      ? persona.modelRequests - control.modelRequests
      : null,
    modelRequestRatio: requestComparable
      ? round(persona.modelRequests / control.modelRequests, 3)
      : null,
    controlTokensPerStep:
      control.tokens === null || control.executedSteps === 0
        ? null
        : round(control.tokens / control.executedSteps, 1),
    personaTokensPerStep:
      persona.tokens === null || persona.executedSteps === 0
        ? null
        : round(persona.tokens / persona.executedSteps, 1),
    elapsedDeltaSeconds: comparable ? persona.elapsedSeconds - control.elapsedSeconds : null,
    elapsedOverheadPercent: comparable
      ? round(
          ((persona.elapsedSeconds - control.elapsedSeconds) / control.elapsedSeconds) * 100,
        )
      : null,
    elapsedRatio: comparable
      ? round(persona.elapsedSeconds / control.elapsedSeconds, 3)
      : null,
    controlSecondsPerStep:
      control.elapsedSeconds === null || control.executedSteps === 0
        ? null
        : round(control.elapsedSeconds / control.executedSteps, 1),
    personaSecondsPerStep:
      persona.elapsedSeconds === null || persona.executedSteps === 0
        ? null
        : round(persona.elapsedSeconds / persona.executedSteps, 1),
    qualityDelta: qualityComparable
      ? round(persona.taskQualityScore - control.taskQualityScore, 1)
      : null,
    qualityNonInferiorityPassed: qualityComparable
      ? persona.taskQualityScore >=
        control.taskQualityScore - validated.nonInferiorityMargin
      : null,
    qualityLabelBlinded: validated.labelBlinded,
  };
}

function signed(value, suffix = "") {
  return value === null ? "n/a" : `${value >= 0 ? "+" : ""}${value}${suffix}`;
}

function display(value) {
  return value === null ? "n/a" : String(value);
}

function score(value) {
  return value === null ? "not scored" : `${value}/100`;
}

export function renderPersonaOverheadMarkdown(result, summary, sourceName = "result.json") {
  const title = `${result.persona.id}/${result.persona.locale}/${result.persona.intensity}`;
  const comparison = summary.comparable
    ? `Token ratio: **${summary.tokenRatio}×**. Elapsed-time ratio: **${summary.elapsedRatio}×**.`
    : result.runtime.sameConfigurationAcrossArms === false
      ? "The arms used different runtime configurations; paired comparisons were not calculated."
      : "The pair is incomplete or excluded; paired comparisons were not calculated.";
  const qualityLabel = summary.qualityLabelBlinded
    ? "Label-blinded task-quality score"
    : "Task-quality score (not label-blinded)";

  return `# Persona overhead: ${title}\n\n` +
    `Source: \`${sourceName}\`  \n` +
    `Commit: \`${result.commit}\`  \n` +
    `Design: paired ${result.runKind}; ${summary.scheduledSteps} scheduled steps per arm\n\n` +
    `| Metric | Control | Persona | Difference |\n` +
    `| --- | ---: | ---: | ---: |\n` +
    `| Status | ${summary.control.status} | ${summary.persona.status} | — |\n` +
    `| Executed steps | ${summary.control.executedSteps} | ${summary.persona.executedSteps} | — |\n` +
    `| Goal-accounted tokens | ${display(summary.control.tokens)} | ${display(summary.persona.tokens)} | ${signed(summary.tokenDelta, summary.tokenDelta === null ? "" : ` (${signed(summary.tokenOverheadPercent, "%")})`)} |\n` +
    `| Elapsed seconds | ${display(summary.control.elapsedSeconds)} | ${display(summary.persona.elapsedSeconds)} | ${signed(summary.elapsedDeltaSeconds, summary.elapsedDeltaSeconds === null ? "" : ` (${signed(summary.elapsedOverheadPercent, "%")})`)} |\n` +
    `| Actual model requests | ${display(summary.control.modelRequests)} | ${display(summary.persona.modelRequests)} | ${signed(summary.modelRequestDelta, summary.modelRequestRatio === null ? "" : ` (${summary.modelRequestRatio}×)`)} |\n` +
    `| Tokens / executed step | ${display(summary.controlTokensPerStep)} | ${display(summary.personaTokensPerStep)} | — |\n` +
    `| Seconds / executed step | ${display(summary.controlSecondsPerStep)} | ${display(summary.personaSecondsPerStep)} | — |\n` +
    `| ${qualityLabel} | ${score(summary.control.taskQualityScore)} | ${score(summary.persona.taskQualityScore)} | ${signed(summary.qualityDelta)} |\n` +
    `| Observed process errors | ${summary.control.processErrors} | ${summary.persona.processErrors} | ${signed(summary.persona.processErrors - summary.control.processErrors)} |\n` +
    `| Self-corrections | ${summary.control.selfCorrections} | ${summary.persona.selfCorrections} | ${signed(summary.persona.selfCorrections - summary.control.selfCorrections)} |\n\n` +
    `${comparison}\n\n` +
    `Quality non-inferiority: **${summary.qualityNonInferiorityPassed === null ? "not scored" : summary.qualityNonInferiorityPassed ? "pass" : "fail"}**.\n\n` +
    `This is a paired ${result.runKind}, not a population estimate. Review failures and limitations before generalizing.\n`;
}

export function parsePersonaOverheadCliArgs(args, env = process.env) {
  let jsonOutput = false;
  let help = false;
  const paths = [];

  for (const argument of args) {
    if (argument === "--") continue;
    if (argument === "--json") {
      jsonOutput = true;
    } else if (argument === "--help" || argument === "-h") {
      help = true;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      paths.push(argument);
    }
  }

  if (paths.length > 1) {
    throw new Error("Expected at most one result path.");
  }
  const requestedPath = paths[0] ?? env.PERSONA_OVERHEAD_RESULT;
  if (!help && !requestedPath) {
    throw new Error(PERSONA_OVERHEAD_USAGE);
  }
  return { help, jsonOutput, requestedPath: requestedPath ?? null };
}

async function runCli(args) {
  const options = parsePersonaOverheadCliArgs(args);
  if (options.help) {
    process.stdout.write(`${PERSONA_OVERHEAD_USAGE}\n`);
    return;
  }

  const inputPath = resolve(options.requestedPath);
  const result = JSON.parse(await readFile(inputPath, "utf8"));
  const summary = summarizePersonaOverheadResult(result);
  const output = options.jsonOutput
    ? `${JSON.stringify(summary, null, 2)}\n`
    : renderPersonaOverheadMarkdown(result, summary, basename(inputPath));
  process.stdout.write(output);
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  runCli(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
