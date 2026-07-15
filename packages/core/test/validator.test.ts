import { describe, expect, it } from "vitest";

import { PersonaValidationError } from "../src/errors.js";
import {
  collectPersonaValidationIssues,
  collectPersonaV1ValidationIssues,
  collectPersonaV2ValidationIssues,
  getPersonaSchema,
  getPersonaSchemaV1,
  getPersonaSchemaV2,
  isPersonaManifest,
  isPersonaManifestV1,
  isPersonaManifestV2,
  validatePersonaManifest,
  validatePersonaManifestV1,
  validatePersonaManifestV2,
} from "../src/validator.js";
import { createManifest, createManifestV2 } from "./fixture.js";

function appendEnglishItem(
  localized: { readonly en: readonly string[] },
  item: string,
): void {
  (localized.en as string[]).push(item);
}

describe("persona manifest validation", () => {
  it("accepts the complete v1 contract", () => {
    const manifest = createManifest();

    expect(isPersonaManifest(manifest)).toBe(true);
    expect(validatePersonaManifest(manifest)).toBe(manifest);
    expect(collectPersonaValidationIssues(manifest)).toEqual([]);
  });

  it("reports all schema violations with useful paths", () => {
    const invalid = {
      ...createManifest(),
      color: "gold",
      unexpected: true,
    };

    const issues = collectPersonaValidationIssues(invalid);
    expect(issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(["$/unexpected", "/color"]),
    );
    expect(() => validatePersonaManifest(invalid, "fixture.json")).toThrow(
      PersonaValidationError,
    );
  });

  it("requires both translations at every localized boundary", () => {
    const invalid = structuredClone(createManifest()) as unknown as Record<string, unknown>;
    const locales = invalid.locales as Record<string, unknown>;
    delete locales.ru;

    expect(collectPersonaValidationIssues(invalid)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/locales/ru", keyword: "required" }),
      ]),
    );
  });

  it.each([
    ["newline", "Teacher\nforged"],
    ["terminal escape", "Teacher\u001b]52;c;Zm9yZ2Vk\u0007"],
    ["bidirectional override", "Teacher\u202eforged"],
  ])("rejects %s control characters in printable fields", (_name, unsafeName) => {
    const invalid = structuredClone(createManifest());
    (invalid.locales.en as { name: string }).name = unsafeName;

    expect(collectPersonaValidationIssues(invalid)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/locales/en/name", keyword: "pattern" }),
      ]),
    );
    expect(() => validatePersonaManifest(invalid)).toThrow(PersonaValidationError);
  });

  it("applies control-character protection to category, content, and attribution", () => {
    const invalid = {
      ...createManifest(),
      category: "education\nforged",
      attribution: "Project contributors\u202e.gpj",
      locales: {
        ...createManifest().locales,
        en: {
          ...createManifest().locales.en,
          basePrompt: "Teach clearly.\u001b[2J",
        },
      },
    };

    expect(collectPersonaValidationIssues(invalid).map((issue) => issue.path)).toEqual(
      expect.arrayContaining(["/category", "/attribution", "/locales/en/basePrompt"]),
    );
  });

  it("escapes hostile property names in validation diagnostics", () => {
    const property = "field-\u001b]52;c;Zm9yZ2Vk\u0007";
    const invalid = { ...createManifest(), [property]: true };
    const issues = collectPersonaValidationIssues(invalid);

    expect(issues[0]?.path).not.toMatch(/[\u001b\u0007]/u);
    expect(issues[0]?.path).toContain("\\u001B]52;c;Zm9yZ2Vk\\u0007");

    try {
      validatePersonaManifest(invalid);
      throw new Error("Expected validation to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(PersonaValidationError);
      expect((error as Error).message).not.toMatch(/[\u001b\u0007]/u);
      expect((error as Error).message).toContain("\\u001B]52;c;Zm9yZ2Vk\\u0007");
    }
  });

  it.each(["1.0.0-..", "1.0.0-01", "1.0.0-alpha..1"])(
    "rejects invalid semantic version %s",
    (version) => {
      expect(isPersonaManifest({ ...createManifest(), version })).toBe(false);
    },
  );

  it("accepts a strict semantic version with prerelease and build metadata", () => {
    expect(
      isPersonaManifest({ ...createManifest(), version: "1.0.0-alpha.1+build.5" }),
    ).toBe(true);
  });

  it("keeps explicit v1 validation and the default schema getter mapped to v1", () => {
    const manifest = createManifest();
    expect(isPersonaManifestV1(manifest)).toBe(true);
    expect(validatePersonaManifestV1(manifest)).toBe(manifest);
    expect(collectPersonaV1ValidationIssues(manifest)).toEqual([]);
    expect(getPersonaSchema()).toBe(getPersonaSchemaV1());
    expect(getPersonaSchemaV2()).not.toBe(getPersonaSchemaV1());
  });

  it("accepts the normative v2 shape through explicit and dispatched validators", () => {
    const manifest = createManifestV2();
    expect(isPersonaManifestV2(manifest)).toBe(true);
    expect(isPersonaManifest(manifest)).toBe(true);
    expect(validatePersonaManifestV2(manifest)).toBe(manifest);
    expect(validatePersonaManifest(manifest)).toBe(manifest);
    expect(collectPersonaV2ValidationIssues(manifest)).toEqual([]);
  });

  it("rejects v2 missing, extra, mixed-layer, malformed-id, and cardinality violations", () => {
    const invalid = structuredClone(createManifestV2()) as unknown as Record<string, unknown>;
    delete invalid.display;
    invalid.locales = createManifest().locales;
    invalid.id = "Teacher_bad";
    const voice = invalid.voice as { directions: { en: string[]; ru: string[] } };
    voice.directions.en = ["Too short"];

    const issues = collectPersonaV2ValidationIssues(invalid);
    expect(issues.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        "$/display",
        "$/locales",
        "/id",
        "/voice/directions/en",
      ]),
    );
  });

  it("rejects duplicate task/example ids and invalid legacy references semantically", () => {
    const invalid = structuredClone(createManifestV2()) as unknown as {
      taskModes: Array<{ id: string }>;
      voice: { examples: Array<{ id: string }> };
      compatibility: { legacyTaskModeId: string };
    };
    invalid.taskModes[1]!.id = invalid.taskModes[0]!.id;
    invalid.voice.examples[1]!.id = invalid.voice.examples[0]!.id;
    invalid.compatibility.legacyTaskModeId = "missing-mode";

    expect(collectPersonaV2ValidationIssues(invalid)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/taskModes/1/id", keyword: "uniqueId" }),
        expect.objectContaining({ path: "/voice/examples/1/id", keyword: "uniqueId" }),
        expect.objectContaining({
          path: "/compatibility/legacyTaskModeId",
          keyword: "legacyTaskModeId",
        }),
      ]),
    );
  });

  it.each([
    [
      "Safety risks",
      "/safety/risks",
      (manifest: ReturnType<typeof createManifestV2>) =>
        appendEnglishItem(manifest.safety.risks, "Another risk."),
    ],
    [
      "Safety pre-action rules",
      "/safety/preActionRules",
      (manifest: ReturnType<typeof createManifestV2>) =>
        appendEnglishItem(manifest.safety.preActionRules, "Another rule."),
    ],
    [
      "Safety boundaries",
      "/safety/boundaries",
      (manifest: ReturnType<typeof createManifestV2>) =>
        appendEnglishItem(manifest.safety.boundaries, "Another boundary."),
    ],
    [
      "Voice directions",
      "/voice/directions",
      (manifest: ReturnType<typeof createManifestV2>) =>
        appendEnglishItem(manifest.voice.directions, "Another direction."),
    ],
    [
      "Voice avoid rules",
      "/voice/avoid",
      (manifest: ReturnType<typeof createManifestV2>) =>
        appendEnglishItem(manifest.voice.avoid, "Another exclusion."),
    ],
    [
      "first Task suitability",
      "/taskModes/0/suitability",
      (manifest: ReturnType<typeof createManifestV2>) =>
        appendEnglishItem(manifest.taskModes[0]!.suitability, "Another use case."),
    ],
    [
      "first Task exclusions",
      "/taskModes/0/exclusions",
      (manifest: ReturnType<typeof createManifestV2>) =>
        appendEnglishItem(manifest.taskModes[0]!.exclusions, "Another exclusion."),
    ],
    [
      "first Task instructions",
      "/taskModes/0/instructions",
      (manifest: ReturnType<typeof createManifestV2>) =>
        appendEnglishItem(manifest.taskModes[0]!.instructions, "Another instruction."),
    ],
    [
      "nested lists in every Task mode",
      "/taskModes/1/instructions",
      (manifest: ReturnType<typeof createManifestV2>) =>
        appendEnglishItem(manifest.taskModes[1]!.instructions, "Another instruction."),
    ],
  ] as const)("rejects asymmetric %s with an actionable path", (_label, path, mutate) => {
    const invalid = structuredClone(createManifestV2());
    mutate(invalid);

    expect(collectPersonaV2ValidationIssues(invalid)).toEqual([
      {
        path,
        keyword: "localizedListParity",
        message: expect.stringMatching(/equal item counts; received en=\d+ and ru=\d+/u),
      },
    ]);
    expect(() => validatePersonaManifestV2(invalid, "asymmetric.json")).toThrow(
      new RegExp(`${path.replaceAll("/", "\\/")}.*equal item counts`, "u"),
    );
  });

  it("dispatches unknown schema versions to an actionable error", () => {
    const invalid = { ...createManifestV2(), schemaVersion: "3.0.0" };
    const issues = collectPersonaValidationIssues(invalid);
    expect(issues).toEqual([
      expect.objectContaining({
        path: "/schemaVersion",
        keyword: "schemaVersion",
        message: expect.stringContaining('supported versions are "1.0.0" and "2.0.0"'),
      }),
    ]);
    expect(() => validatePersonaManifest(invalid, "unknown.json")).toThrow(
      /unsupported persona schemaVersion "3\.0\.0"/u,
    );
  });
});
