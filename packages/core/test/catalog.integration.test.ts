import { describe, expect, it } from "vitest";

import {
  BUILT_IN_PERSONA_IDS,
  buildPersonaLayerMatrix,
  buildPersonaMatrix,
  getPersona,
  listPersonas,
  PERSONA_INTENSITIES,
  PERSONA_LOCALES,
  validatePersonaPath,
} from "../src/index.js";

const BUILT_IN_LAYER_IDS = {
  butler: {
    taskModes: ["butler-organize", "butler-decision-brief"],
    examples: [
      "butler-status-polish",
      "butler-polite-decline",
      "butler-schedule-note",
      "butler-uncertainty-note",
    ],
  },
  catgirl: {
    taskModes: ["catgirl-creative-sprint", "catgirl-small-pounce"],
    examples: [
      "catgirl-variable-polish",
      "catgirl-decision-polish",
      "catgirl-uncertainty-polish",
      "catgirl-serious-polish",
    ],
  },
  detective: {
    taskModes: ["detective-root-cause", "detective-evidence-review"],
    examples: [
      "detective-latency-polish",
      "detective-motive-polish",
      "detective-confidence-polish",
      "detective-dashboard-polish",
    ],
  },
  knight: {
    taskModes: ["knight-quest-plan", "knight-courageous-conversation"],
    examples: [
      "knight-migration-polish",
      "knight-deadline-polish",
      "knight-courage-polish",
      "knight-uncertainty-polish",
    ],
  },
  teacher: {
    taskModes: ["teacher-guided-learning", "teacher-practice-plan"],
    examples: [
      "teacher-recursion-polish",
      "teacher-seasons-polish",
      "teacher-correlation-polish",
      "teacher-uncertainty-polish",
    ],
  },
  wizard: {
    taskModes: ["wizard-system-map", "wizard-concept-bridge"],
    examples: [
      "wizard-encryption-polish",
      "wizard-uncertainty-polish",
      "wizard-debt-polish",
      "wizard-code-polish",
    ],
  },
  yandere: {
    taskModes: ["yandere-detail-audit", "yandere-focus-sprint"],
    examples: [
      "yandere-checklist-polish",
      "yandere-report-polish",
      "yandere-autonomy-polish",
      "yandere-crisis-polish",
    ],
  },
} as const;

const BALANCED_CUE_MARKERS = {
  butler: { en: "poised-service cues", ru: "сигналы безупречного сервиса" },
  catgirl: { en: "playful-feline cues", ru: "игриво-кошачьи сигналы" },
  detective: { en: "case-file cues", ru: "сигналы из материалов дела" },
  knight: { en: "chivalric cues", ru: "рыцарские сигналы" },
  teacher: { en: "mentor-like cues", ru: "наставнические сигналы" },
  wizard: { en: "arcane cues", ru: "магические сигналы" },
  yandere: { en: "task-devotion cues", ru: "сигналы преданности задаче" },
} as const;

describe("built-in catalog", () => {
  it("contains seven valid bilingual v2 personas and locks public mode/example ids", () => {
    const report = validatePersonaPath();
    expect(report.valid, JSON.stringify(report.failures, null, 2)).toBe(true);
    expect(report.personaIds).toEqual([...BUILT_IN_PERSONA_IDS]);
    expect(listPersonas()).toHaveLength(7);

    const ids = Object.fromEntries(
      BUILT_IN_PERSONA_IDS.map((id) => {
        const persona = getPersona(id);
        expect(persona.schemaVersion).toBe("2.0.0");
        if (persona.schemaVersion !== "2.0.0") {
          throw new Error(`Expected ${id} to be a v2 persona.`);
        }

        for (const locale of PERSONA_LOCALES) {
          expect(persona.safety.risks[locale].length).toBeGreaterThanOrEqual(1);
          expect(persona.safety.preActionRules[locale].length).toBeGreaterThanOrEqual(1);
          expect(persona.safety.boundaries[locale].length).toBeGreaterThanOrEqual(1);
          expect(persona.voice.directions[locale].length).toBeGreaterThanOrEqual(4);
          expect(persona.voice.avoid[locale].length).toBeGreaterThanOrEqual(2);
          expect(
            new Set(
              PERSONA_INTENSITIES.map(
                (intensity) => persona.voice.intensity[intensity][locale],
              ),
            ).size,
          ).toBe(PERSONA_INTENSITIES.length);
        }

        expect(persona.taskModes.some(({ id: modeId }) => modeId === persona.compatibility.legacyTaskModeId)).toBe(true);
        return [
          id,
          {
            taskModes: persona.taskModes.map(({ id: modeId }) => modeId),
            examples: persona.voice.examples.map(({ id: exampleId }) => exampleId),
          },
        ];
      }),
    );

    expect(ids).toEqual(BUILT_IN_LAYER_IDS);
  });

  it("gives every balanced Voice a host-budgeted persona dose with explicit overrides", () => {
    for (const id of BUILT_IN_PERSONA_IDS) {
      const persona = getPersona(id);
      expect(persona.schemaVersion).toBe("2.0.0");
      if (persona.schemaVersion !== "2.0.0") {
        throw new Error(`Expected ${id} to be a v2 persona.`);
      }

      const en = persona.voice.intensity.balanced.en;
      expect(en).toContain("Use the trusted host target");
      expect(en).toContain(BALANCED_CUE_MARKERS[id].en);
      expect(en).toContain("eligible prose");
      expect(en).toContain("Fidelity, safety, exact format, and neutral control override it");

      const ru = persona.voice.intensity.balanced.ru;
      expect(ru).toContain("Используй доверенную цель хоста");
      expect(ru).toContain(BALANCED_CUE_MARKERS[id].ru);
      expect(ru).toContain("подходящему тексту");
      expect(ru).toContain(
        "Сохранение содержания, безопасность, точный формат и нейтральная подача важнее",
      );

      if (id === "wizard") {
        expect(persona.voice.directions.en).toContain(
          "Add motifs only as natural, short, detachable sentences at paragraph edges; never replace source wording with imagery.",
        );
        expect(persona.voice.directions.ru).toContain(
          "Добавляй мотивы только естественными короткими отделимыми предложениями на границах абзацев; никогда не заменяй образами формулировки источника.",
        );
      }

      for (const locale of PERSONA_LOCALES) {
        expect(
          new Set(
            PERSONA_INTENSITIES.map(
              (intensity) => persona.voice.intensity[intensity][locale],
            ),
          ).size,
        ).toBe(PERSONA_INTENSITIES.length);
      }
    }
  });

  it("builds 42 frozen-path Legacy variants and the complete v2 layer matrix", () => {
    const legacy = buildPersonaMatrix();
    expect(legacy).toHaveLength(42);
    expect(
      legacy.map(({ id, locale, intensity }) => `${id}/${locale}/${intensity}`),
    ).toEqual(
      BUILT_IN_PERSONA_IDS.flatMap((id) =>
        PERSONA_LOCALES.flatMap((locale) =>
          PERSONA_INTENSITIES.map((intensity) => `${id}/${locale}/${intensity}`),
        ),
      ),
    );

    const layers = buildPersonaLayerMatrix();
    expect(layers).toHaveLength(BUILT_IN_PERSONA_IDS.length * PERSONA_LOCALES.length);
    expect(layers.map(({ id, locale }) => `${id}/${locale}`)).toEqual(
      BUILT_IN_PERSONA_IDS.flatMap((id) => PERSONA_LOCALES.map((locale) => `${id}/${locale}`)),
    );
    for (const entry of layers) {
      expect(entry.safety.prompt.length).toBeGreaterThan(0);
      expect(Object.keys(entry.voice)).toEqual([...PERSONA_INTENSITIES]);
      expect(entry.taskModes.map(({ taskModeId }) => taskModeId)).toEqual(
        BUILT_IN_LAYER_IDS[entry.id as keyof typeof BUILT_IN_LAYER_IDS].taskModes,
      );
    }
  });
});
