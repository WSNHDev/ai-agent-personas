import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PersonaNotFoundError,
  PersonaSourceError,
  PersonaValidationError,
} from "./errors.js";
import type {
  PersonaManifestV1,
  PersonaPathValidationFailure,
  PersonaPathValidationReport,
  PersonaSourceOptions,
  PersonaSummary,
} from "./types.js";
import { validatePersonaManifest } from "./validator.js";

const PERSONA_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

function isMissingPathError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }
  return error.code === "ENOENT" || error.code === "ENOTDIR";
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch (error) {
    if (isMissingPathError(error)) {
      return false;
    }
    throw new PersonaSourceError(`Could not inspect path: ${path}`, { cause: error });
  }
}

function findWorkspacePersonas(start: string): string | undefined {
  let current = resolve(start);
  const root = parse(current).root;

  while (true) {
    const candidate = join(current, "personas");
    if (isDirectory(candidate)) {
      return candidate;
    }

    if (current === root) {
      return undefined;
    }
    current = dirname(current);
  }
}

export function resolvePersonasDirectory(explicitDirectory?: string): string {
  const configured = explicitDirectory ?? process.env.AI_AGENT_PERSONAS_DIR;
  if (configured) {
    const absolute = resolve(configured);
    if (!isDirectory(absolute)) {
      throw new PersonaSourceError(`Personas directory does not exist: ${absolute}`);
    }
    return absolute;
  }

  const bundled = fileURLToPath(new URL("./personas", import.meta.url));
  if (isDirectory(bundled)) {
    return bundled;
  }

  const fromCwd = findWorkspacePersonas(process.cwd());
  if (fromCwd) {
    return fromCwd;
  }

  const fromModule = findWorkspacePersonas(dirname(fileURLToPath(import.meta.url)));
  if (fromModule) {
    return fromModule;
  }

  throw new PersonaSourceError(
    "Could not locate the personas directory. Pass personasDirectory or set AI_AGENT_PERSONAS_DIR.",
  );
}

function listPersonaManifestCandidates(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => join(directory, entry.name, "persona.json"))
    .sort((left, right) => left.localeCompare(right, "en"));
}

export function listPersonaManifestFiles(options: PersonaSourceOptions = {}): readonly string[] {
  const directory = resolvePersonasDirectory(options.personasDirectory);
  const files = listPersonaManifestCandidates(directory);
  const missing = files.find((file) => !existsSync(file));

  if (missing) {
    throw new PersonaSourceError(`Persona directory is missing its manifest: ${missing}`);
  }
  return files;
}

function parseJsonFile(file: string): unknown {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch (error) {
    throw new PersonaSourceError(`Could not read persona manifest: ${file}`, { cause: error });
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new PersonaValidationError(file, [
      {
        path: "$",
        message: error instanceof Error ? error.message : "invalid JSON",
        keyword: "parse",
      },
    ]);
  }
}

export function loadPersonaFile(file: string): PersonaManifestV1 {
  const absolute = isAbsolute(file) ? file : resolve(file);
  const manifest = validatePersonaManifest(parseJsonFile(absolute), absolute);
  const directoryId = dirname(absolute).split(/[\\/]/u).at(-1);

  if (directoryId && directoryId !== manifest.id && absolute.endsWith("persona.json")) {
    throw new PersonaValidationError(absolute, [
      {
        path: "/id",
        message: `must match its directory name \"${directoryId}\"`,
        keyword: "directoryId",
      },
    ]);
  }

  return manifest;
}

export function getPersona(id: string, options: PersonaSourceOptions = {}): PersonaManifestV1 {
  if (!PERSONA_ID_PATTERN.test(id)) {
    throw new PersonaNotFoundError(id);
  }

  const directory = resolvePersonasDirectory(options.personasDirectory);
  const file = join(directory, id, "persona.json");
  if (!existsSync(file)) {
    throw new PersonaNotFoundError(id);
  }

  return loadPersonaFile(file);
}

export function listPersonas(options: PersonaSourceOptions = {}): readonly PersonaSummary[] {
  return listPersonaManifestFiles(options)
    .map(loadPersonaFile)
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
    .map((manifest) => ({
      id: manifest.id,
      version: manifest.version,
      category: manifest.category,
      tags: [...manifest.tags],
      color: manifest.color,
      name: {
        en: manifest.locales.en.name,
        ru: manifest.locales.ru.name,
      },
      summary: {
        en: manifest.locales.en.summary,
        ru: manifest.locales.ru.summary,
      },
      safetyRating: manifest.safety.rating,
    }));
}

function filesForValidationPath(inputPath?: string): readonly string[] {
  if (!inputPath) {
    const directory = resolvePersonasDirectory();
    const files = listPersonaManifestCandidates(directory);
    if (files.length === 0) {
      throw new PersonaSourceError(`No persona.json manifests found in: ${directory}`);
    }
    return files;
  }

  const absolute = resolve(inputPath);
  if (!existsSync(absolute)) {
    throw new PersonaSourceError(`Validation path does not exist: ${absolute}`);
  }
  if (!isDirectory(absolute)) {
    return [absolute];
  }

  const directManifest = join(absolute, "persona.json");
  if (existsSync(directManifest)) {
    return [directManifest];
  }

  const files = listPersonaManifestCandidates(absolute);
  if (files.length === 0) {
    throw new PersonaSourceError(`No persona.json manifests found in: ${absolute}`);
  }
  return files;
}

export function validatePersonaPath(inputPath?: string): PersonaPathValidationReport {
  const files = filesForValidationPath(inputPath);
  const personaIds: string[] = [];
  const failures: PersonaPathValidationFailure[] = [];

  for (const file of files) {
    try {
      personaIds.push(loadPersonaFile(file).id);
    } catch (error) {
      if (error instanceof PersonaValidationError) {
        failures.push({ file, message: error.message, issues: error.issues });
      } else {
        failures.push({
          file,
          message: error instanceof Error ? error.message : String(error),
          issues: [],
        });
      }
    }
  }

  return {
    valid: failures.length === 0,
    checked: files.length,
    personaIds: personaIds.sort((left, right) => left.localeCompare(right, "en")),
    failures,
  };
}
