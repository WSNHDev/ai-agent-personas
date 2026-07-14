import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  PersonaNotFoundError,
  PersonaSourceError,
  PersonaValidationError,
} from "../src/errors.js";
import {
  getPersona,
  listPersonaManifestFiles,
  listPersonas,
  loadPersonaFile,
  resolvePersonasDirectory,
  validatePersonaPath,
} from "../src/loader.js";
import { createManifest, writeManifest } from "./fixture.js";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "persona-core-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("persona loader", () => {
  it("loads canonical manifests and returns stable sorted summaries", () => {
    const root = temporaryDirectory();
    writeManifest(root, createManifest("wizard"));
    writeManifest(root, createManifest("teacher"));

    expect(listPersonaManifestFiles({ personasDirectory: root })).toHaveLength(2);
    expect(listPersonas({ personasDirectory: root }).map((persona) => persona.id)).toEqual([
      "teacher",
      "wizard",
    ]);
    expect(getPersona("wizard", { personasDirectory: root }).id).toBe("wizard");
    expect(() => getPersona("missing", { personasDirectory: root })).toThrow(
      PersonaNotFoundError,
    );
  });

  it("rejects a manifest whose id differs from its directory", () => {
    const root = temporaryDirectory();
    const directory = join(root, "wrong-directory");
    mkdirSync(directory, { recursive: true });
    const file = join(directory, "persona.json");
    writeFileSync(file, JSON.stringify(createManifest("teacher")), "utf8");

    expect(() => loadPersonaFile(file)).toThrow(PersonaValidationError);
  });

  it("collects invalid manifests into a validation report", () => {
    const root = temporaryDirectory();
    writeManifest(root, createManifest("teacher"));
    const invalidDirectory = join(root, "wizard");
    mkdirSync(invalidDirectory, { recursive: true });
    writeFileSync(join(invalidDirectory, "persona.json"), "{ bad json", "utf8");

    const report = validatePersonaPath(root);
    expect(report.valid).toBe(false);
    expect(report.checked).toBe(2);
    expect(report.personaIds).toEqual(["teacher"]);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]?.issues[0]?.keyword).toBe("parse");
  });

  it("reports persona directories that are missing persona.json", () => {
    const root = temporaryDirectory();
    writeManifest(root, createManifest("teacher"));
    mkdirSync(join(root, "wizard"), { recursive: true });

    expect(() => listPersonaManifestFiles({ personasDirectory: root })).toThrow(
      /missing its manifest/u,
    );
    const report = validatePersonaPath(root);
    expect(report.valid).toBe(false);
    expect(report.checked).toBe(2);
    expect(report.personaIds).toEqual(["teacher"]);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]?.file).toBe(join(root, "wizard", "persona.json"));
    expect(report.failures[0]?.message).toContain("Could not read persona manifest");
  });

  it("preserves unexpected path-inspection failures", () => {
    expect(() => resolvePersonasDirectory("\0")).toThrow(PersonaSourceError);
    expect(() => resolvePersonasDirectory("\0")).toThrow(/Could not inspect path/u);
  });
});
