import { describe, expect, it } from "vitest";

import {
  BUILT_IN_PERSONA_IDS,
  buildPersonaMatrix,
  getPersona,
  listPersonas,
  PERSONA_INTENSITIES,
  PERSONA_LOCALES,
  validatePersonaPath,
} from "../src/index.js";

describe("built-in catalog", () => {
  it("contains seven valid bilingual personas and 42 compiled variants", () => {
    const report = validatePersonaPath();
    expect(report.valid, JSON.stringify(report.failures, null, 2)).toBe(true);
    expect(report.personaIds).toEqual([...BUILT_IN_PERSONA_IDS]);
    expect(listPersonas()).toHaveLength(7);

    for (const id of BUILT_IN_PERSONA_IDS) {
      const persona = getPersona(id);
      expect(persona.locales.en.examples).toHaveLength(persona.locales.ru.examples.length);

      for (const locale of PERSONA_LOCALES) {
        const content = persona.locales[locale];
        expect(content.traits.length).toBeGreaterThanOrEqual(4);
        expect(content.principles.length).toBeGreaterThanOrEqual(4);
        expect(content.examples.length).toBeGreaterThanOrEqual(6);
        expect(
          new Set(PERSONA_INTENSITIES.map((intensity) => persona.intensity[intensity][locale])).size,
        ).toBe(PERSONA_INTENSITIES.length);
      }
    }

    const matrix = buildPersonaMatrix();
    expect(matrix).toHaveLength(42);
    for (const id of BUILT_IN_PERSONA_IDS) {
      for (const locale of PERSONA_LOCALES) {
        const prompts = matrix
          .filter((variant) => variant.id === id && variant.locale === locale)
          .map((variant) => variant.text);
        expect(new Set(prompts).size).toBe(PERSONA_INTENSITIES.length);
      }
    }
  });
});
