import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildPersonaMatrix,
  compilePersona,
  compilePersonaManifest,
} from "../src/compiler.js";
import { PersonaSourceError, PersonaValidationError } from "../src/errors.js";
import {
  BUILT_IN_PERSONA_IDS,
  PERSONA_INTENSITIES,
  PERSONA_LOCALES,
} from "../src/types.js";
import { createManifest, writeManifest } from "./fixture.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("prompt compiler", () => {
  it("renders a stable, complete text prompt", () => {
    const output = compilePersonaManifest(createManifest(), {
      locale: "en",
      intensity: "balanced",
      format: "text",
    });

    expect(output).toBe(
      compilePersonaManifest(createManifest(), {
        locale: "en",
        intensity: "balanced",
        format: "text",
      }),
    );
    expect(
      output
        .split("\n")
        .filter((line) => /^[A-Z][A-Z ]+$/u.test(line)),
    ).toMatchInlineSnapshot(`
      [
        "SUMMARY",
        "OPERATING PRIORITY",
        "IDENTITY",
        "INTENSITY",
        "TRAITS",
        "PRINCIPLES",
        "GOALS",
        "RULES",
        "SAFETY",
        "AVOID",
        "STYLE EXAMPLES",
      ]
    `);
    expect(output).toContain("User: Explain this.");
    expect(output).toContain("Never sacrifice factual accuracy");
  });

  it("produces markdown and machine-readable JSON from the same prompt", () => {
    const manifest = createManifest();
    const text = compilePersonaManifest(manifest, { format: "text" });
    const markdown = compilePersonaManifest(manifest, { format: "markdown" });
    const json = JSON.parse(compilePersonaManifest(manifest, { format: "json" })) as {
      prompt: string;
      id: string;
      intensity: string;
    };

    expect(markdown.startsWith("# PERSONA: Teacher\n")).toBe(true);
    expect(json).toMatchObject({ id: "teacher", intensity: "balanced", prompt: text });
  });

  it("validates manifests at the public compiler boundary", () => {
    const manifest = createManifest();
    const invalid = {
      ...manifest,
      safety: {
        ...manifest.safety,
        rules: { ...manifest.safety.rules, en: [] },
      },
    };

    expect(() => compilePersonaManifest(invalid)).toThrow(PersonaValidationError);
  });

  it.each([
    ["locale", { locale: "de" }, /Unsupported persona locale: "de"/u],
    ["intensity", { intensity: "loud" }, /Unsupported persona intensity: "loud"/u],
    ["format", { format: "yaml" }, /Unsupported persona output format: "yaml"/u],
  ] as const)("rejects an unsupported runtime %s", (_name, options, message) => {
    expect(() => compilePersonaManifest(createManifest(), options as never)).toThrow(
      PersonaSourceError,
    );
    expect(() => compilePersonaManifest(createManifest(), options as never)).toThrow(message);
  });

  it("rejects malformed compilePersona options before touching a persona source", () => {
    expect(() => compilePersona("teacher", null as never)).toThrow(PersonaSourceError);
    expect(() => compilePersona("teacher", null as never)).toThrow(
      /compile options must be an object/u,
    );
  });

  it("builds the deterministic 7 × 2 × 3 matrix in stable order", () => {
    const root = mkdtempSync(join(tmpdir(), "persona-matrix-"));
    temporaryDirectories.push(root);
    for (const id of BUILT_IN_PERSONA_IDS) {
      writeManifest(root, createManifest(id));
    }

    const matrix = buildPersonaMatrix({ personasDirectory: root });
    expect(matrix).toHaveLength(
      BUILT_IN_PERSONA_IDS.length * PERSONA_LOCALES.length * PERSONA_INTENSITIES.length,
    );
    expect(matrix.map(({ id, locale, intensity }) => `${id}/${locale}/${intensity}`)).toEqual(
      [...matrix]
        .map(({ id, locale, intensity }) => `${id}/${locale}/${intensity}`)
        .sort((left, right) => {
          const [leftId] = left.split("/");
          const [rightId] = right.split("/");
          if (leftId !== rightId) return leftId!.localeCompare(rightId!, "en");
          return 0;
        }),
    );
    expect(matrix[0]).toMatchObject({
      id: "butler",
      locale: "en",
      intensity: "subtle",
    });
    expect(matrix.at(-1)).toMatchObject({
      id: "yandere",
      locale: "ru",
      intensity: "immersive",
    });
  });
});
