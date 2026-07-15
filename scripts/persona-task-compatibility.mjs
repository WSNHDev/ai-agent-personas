import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

const matrixUrl = new URL(
  "../benchmarks/persona-overhead/compatibility-matrix-v1.json",
  import.meta.url,
);
const matrixSource = readFileSync(matrixUrl);

export const PERSONA_TASK_COMPATIBILITY_MATRIX_SHA256 = createHash("sha256")
  .update(matrixSource)
  .digest("hex");

export const PERSONA_TASK_COMPATIBILITY_MATRIX = JSON.parse(
  matrixSource.toString("utf8"),
);

const personasUrl = new URL("../personas/", import.meta.url);

function uniqueIds(values, label) {
  if (!Array.isArray(values)) {
    throw new TypeError(`${label} must be an array.`);
  }
  const ids = values.map((value) => value?.id);
  if (ids.some((value) => typeof value !== "string" || value.length === 0)) {
    throw new TypeError(`${label} must contain non-empty string IDs.`);
  }
  if (new Set(ids).size !== ids.length) {
    throw new TypeError(`${label} IDs must be unique.`);
  }
  return ids;
}

function canonicalPersonaCatalog() {
  return readdirSync(personasUrl, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) =>
      JSON.parse(readFileSync(new URL(`${entry.name}/persona.json`, personasUrl), "utf8")),
    )
    .filter((manifest) => manifest.schemaVersion === "2.0.0")
    .map((manifest) => ({
      id: manifest.id,
      version: manifest.version,
      schemaVersion: manifest.schemaVersion,
      taskModeIds: uniqueIds(manifest.taskModes, `persona ${manifest.id} taskModes`),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export const PERSONA_TASK_MODE_CATALOG = canonicalPersonaCatalog();

export function validatePersonaTaskCompatibilityCatalog(
  matrix = PERSONA_TASK_COMPATIBILITY_MATRIX,
  catalog = PERSONA_TASK_MODE_CATALOG,
) {
  if (matrix?.schemaVersion !== "1.0.0") {
    throw new TypeError("Unsupported task compatibility matrix schemaVersion.");
  }
  const matrixPersonaIds = uniqueIds(matrix.personas, "Task compatibility matrix personas").sort();
  const catalogPersonaIds = uniqueIds(catalog, "Canonical persona catalog").sort();
  if (JSON.stringify(matrixPersonaIds) !== JSON.stringify(catalogPersonaIds)) {
    throw new TypeError(
      "Task compatibility matrix persona IDs must exactly match canonical v2 persona manifests.",
    );
  }

  for (const catalogPersona of catalog) {
    const matrixPersona = matrix.personas.find((persona) => persona.id === catalogPersona.id);
    const matrixModeIds = uniqueIds(
      matrixPersona.modes,
      `Task compatibility matrix modes for ${catalogPersona.id}`,
    ).sort();
    const canonicalModeIds = [...catalogPersona.taskModeIds].sort();
    if (JSON.stringify(matrixModeIds) !== JSON.stringify(canonicalModeIds)) {
      throw new TypeError(
        `Task compatibility matrix modes for ${catalogPersona.id} must exactly match its canonical v2 manifest.`,
      );
    }
    for (const mode of matrixPersona.modes) {
      const aligned = mode.alignedFamilies;
      const excluded = mode.excludedFamilies;
      if (!Array.isArray(aligned) || !Array.isArray(excluded) || aligned.length === 0 || excluded.length === 0) {
        throw new TypeError(
          `Task compatibility matrix mode ${catalogPersona.id}/${mode.id} must define non-empty aligned and excluded families.`,
        );
      }
      if (new Set(aligned).size !== aligned.length || new Set(excluded).size !== excluded.length) {
        throw new TypeError(
          `Task compatibility matrix mode ${catalogPersona.id}/${mode.id} family IDs must be unique.`,
        );
      }
      if (aligned.some((family) => excluded.includes(family))) {
        throw new TypeError(
          `Task compatibility matrix mode ${catalogPersona.id}/${mode.id} cannot align and exclude the same family.`,
        );
      }
    }
  }
  return true;
}

validatePersonaTaskCompatibilityCatalog();

function findById(values, id, label) {
  if (!Array.isArray(values)) {
    throw new TypeError(`Task compatibility matrix ${label} collection must be an array.`);
  }
  const matches = values.filter((value) => value?.id === id);
  if (matches.length !== 1) {
    throw new TypeError(
      `Task compatibility matrix must contain exactly one ${label} "${id}"; found ${matches.length}.`,
    );
  }
  return matches[0];
}

export function getPersonaTaskModeCompatibility(personaId, taskModeId, family) {
  const persona = findById(
    PERSONA_TASK_COMPATIBILITY_MATRIX.personas,
    personaId,
    "persona",
  );
  const mode = findById(persona.modes, taskModeId, `task mode for ${personaId}`);
  const aligned = mode.alignedFamilies?.includes(family) === true;
  const excluded = mode.excludedFamilies?.includes(family) === true;
  if (aligned === excluded) {
    throw new TypeError(
      `Task family "${family}" must be preregistered exactly once for ${personaId}/${taskModeId}.`,
    );
  }
  return aligned ? "aligned" : "excluded";
}
