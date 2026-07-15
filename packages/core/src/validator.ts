import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import schemaV1 from "../schema/persona.schema.json" with { type: "json" };
import schemaV2 from "../schema/persona-v2.schema.json" with { type: "json" };

import {
  PersonaValidationError,
  escapeTerminalControls,
  type PersonaValidationIssue,
} from "./errors.js";
import type {
  PersonaManifest,
  PersonaManifestV1,
  PersonaManifestV2,
} from "./types.js";

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: false,
});

const validateManifestV1 = ajv.compile(schemaV1) as ValidateFunction<PersonaManifestV1>;
const validateManifestV2 = ajv.compile(schemaV2) as ValidateFunction<PersonaManifestV2>;

function issuePath(error: ErrorObject): string {
  let path = error.instancePath || "$";

  if (error.keyword === "required" && "missingProperty" in error.params) {
    path = `${path}/${String(error.params.missingProperty)}`;
  } else if (error.keyword === "additionalProperties" && "additionalProperty" in error.params) {
    path = `${path}/${String(error.params.additionalProperty)}`;
  }

  return path;
}

function toIssue(error: ErrorObject): PersonaValidationIssue {
  return {
    path: escapeTerminalControls(issuePath(error)),
    message: escapeTerminalControls(error.message ?? "failed validation"),
    keyword: error.keyword,
  };
}

/** Returns the v1 schema for one deprecation cycle. */
export function getPersonaSchema(): Readonly<object> {
  return schemaV1;
}

export function getPersonaSchemaV1(): Readonly<object> {
  return schemaV1;
}

export function getPersonaSchemaV2(): Readonly<object> {
  return schemaV2;
}

function collectSchemaIssues(
  validator: ValidateFunction,
  value: unknown,
): readonly PersonaValidationIssue[] {
  if (validator(value)) {
    return [];
  }

  return (validator.errors ?? []).map(toIssue);
}

function collectDuplicateIdIssues(
  values: readonly { readonly id: string }[],
  path: string,
  label: string,
): readonly PersonaValidationIssue[] {
  const seen = new Set<string>();
  const issues: PersonaValidationIssue[] = [];

  values.forEach((value, index) => {
    if (seen.has(value.id)) {
      issues.push({
        path: `${path}/${index}/id`,
        message: `${label} id \"${escapeTerminalControls(value.id)}\" must be unique`,
        keyword: "uniqueId",
      });
    }
    seen.add(value.id);
  });

  return issues;
}

function collectLocalizedListParityIssues(
  value: unknown,
  path: string,
): readonly PersonaValidationIssue[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      collectLocalizedListParityIssues(entry, `${path}/${index}`),
    );
  }

  if (typeof value !== "object" || value === null) {
    return [];
  }

  const record = value as Readonly<Record<string, unknown>>;
  if (Array.isArray(record.en) && Array.isArray(record.ru)) {
    if (record.en.length === record.ru.length) {
      return [];
    }

    return [
      {
        path,
        message:
          "English and Russian lists must contain equal item counts; " +
          `received en=${record.en.length} and ru=${record.ru.length}`,
        keyword: "localizedListParity",
      },
    ];
  }

  return Object.entries(record).flatMap(([key, entry]) =>
    collectLocalizedListParityIssues(entry, `${path}/${key}`),
  );
}

function collectPersonaV2SemanticIssues(
  manifest: PersonaManifestV2,
): readonly PersonaValidationIssue[] {
  const issues = [
    ...collectDuplicateIdIssues(manifest.taskModes, "/taskModes", "task mode"),
    ...collectDuplicateIdIssues(manifest.voice.examples, "/voice/examples", "voice example"),
    ...collectLocalizedListParityIssues(manifest.safety, "/safety"),
    ...collectLocalizedListParityIssues(manifest.taskModes, "/taskModes"),
    ...collectLocalizedListParityIssues(manifest.voice, "/voice"),
  ];
  const legacyMatches = manifest.taskModes.filter(
    (mode) => mode.id === manifest.compatibility.legacyTaskModeId,
  );

  if (legacyMatches.length !== 1) {
    issues.push({
      path: "/compatibility/legacyTaskModeId",
      message:
        `must reference exactly one declared task mode; received ` +
        `\"${escapeTerminalControls(manifest.compatibility.legacyTaskModeId)}\"`,
      keyword: "legacyTaskModeId",
    });
  }

  return issues;
}

export function collectPersonaV1ValidationIssues(
  value: unknown,
): readonly PersonaValidationIssue[] {
  return collectSchemaIssues(validateManifestV1, value);
}

export function collectPersonaV2ValidationIssues(
  value: unknown,
): readonly PersonaValidationIssue[] {
  const schemaIssues = collectSchemaIssues(validateManifestV2, value);
  if (schemaIssues.length > 0) {
    return schemaIssues;
  }
  return collectPersonaV2SemanticIssues(value as PersonaManifestV2);
}

function schemaVersionOf(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return (value as Readonly<Record<string, unknown>>).schemaVersion;
}

function unsupportedSchemaVersionIssue(version: unknown): PersonaValidationIssue {
  const rendered =
    typeof version === "string"
      ? `\"${escapeTerminalControls(version)}\"`
      : escapeTerminalControls(version);
  return {
    path: "/schemaVersion",
    message: `unsupported persona schemaVersion ${rendered}; supported versions are \"1.0.0\" and \"2.0.0\"`,
    keyword: "schemaVersion",
  };
}

export function collectPersonaValidationIssues(value: unknown): readonly PersonaValidationIssue[] {
  const version = schemaVersionOf(value);
  if (version === "1.0.0") {
    return collectPersonaV1ValidationIssues(value);
  }
  if (version === "2.0.0") {
    return collectPersonaV2ValidationIssues(value);
  }
  if (version === undefined && (typeof value !== "object" || value === null || Array.isArray(value))) {
    return [{ path: "$", message: "must be an object with a supported schemaVersion", keyword: "type" }];
  }
  if (version === undefined) {
    return [
      {
        path: "$/schemaVersion",
        message: 'is required and must be "1.0.0" or "2.0.0"',
        keyword: "required",
      },
    ];
  }
  return [unsupportedSchemaVersionIssue(version)];
}

export function isPersonaManifestV1(value: unknown): value is PersonaManifestV1 {
  return collectPersonaV1ValidationIssues(value).length === 0;
}

export function isPersonaManifestV2(value: unknown): value is PersonaManifestV2 {
  return collectPersonaV2ValidationIssues(value).length === 0;
}

export function isPersonaManifest(value: unknown): value is PersonaManifest {
  return collectPersonaValidationIssues(value).length === 0;
}

export function validatePersonaManifest(
  value: unknown,
  source = "<memory>",
): PersonaManifest {
  const issues = collectPersonaValidationIssues(value);
  if (issues.length > 0) {
    throw new PersonaValidationError(source, issues);
  }

  return value as PersonaManifest;
}

export function validatePersonaManifestV1(
  value: unknown,
  source = "<memory>",
): PersonaManifestV1 {
  const issues = collectPersonaV1ValidationIssues(value);
  if (issues.length > 0) {
    throw new PersonaValidationError(source, issues);
  }
  return value as PersonaManifestV1;
}

export function validatePersonaManifestV2(
  value: unknown,
  source = "<memory>",
): PersonaManifestV2 {
  const issues = collectPersonaV2ValidationIssues(value);
  if (issues.length > 0) {
    throw new PersonaValidationError(source, issues);
  }
  return value as PersonaManifestV2;
}
