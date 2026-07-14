import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import schema from "../schema/persona.schema.json" with { type: "json" };

import {
  PersonaValidationError,
  escapeTerminalControls,
  type PersonaValidationIssue,
} from "./errors.js";
import type { PersonaManifestV1 } from "./types.js";

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: false,
});

const validateManifest = ajv.compile(schema) as ValidateFunction<PersonaManifestV1>;

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

export function getPersonaSchema(): Readonly<object> {
  return schema;
}

export function collectPersonaValidationIssues(value: unknown): readonly PersonaValidationIssue[] {
  if (validateManifest(value)) {
    return [];
  }

  return (validateManifest.errors ?? []).map(toIssue);
}

export function isPersonaManifest(value: unknown): value is PersonaManifestV1 {
  return validateManifest(value);
}

export function validatePersonaManifest(
  value: unknown,
  source = "<memory>",
): PersonaManifestV1 {
  const issues = collectPersonaValidationIssues(value);
  if (issues.length > 0) {
    throw new PersonaValidationError(source, issues);
  }

  return value as PersonaManifestV1;
}
