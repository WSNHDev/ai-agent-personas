import { describe, expect, it } from "vitest";

import { PersonaValidationError } from "../src/errors.js";
import {
  collectPersonaValidationIssues,
  isPersonaManifest,
  validatePersonaManifest,
} from "../src/validator.js";
import { createManifest } from "./fixture.js";

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
      schemaVersion: "2.0.0",
      color: "gold",
      unexpected: true,
    };

    const issues = collectPersonaValidationIssues(invalid);
    expect(issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(["$/unexpected", "/schemaVersion", "/color"]),
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
});
