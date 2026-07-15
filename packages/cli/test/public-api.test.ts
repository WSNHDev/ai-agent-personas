import { describe, expect, it } from "vitest";

import {
  BUILT_IN_PERSONA_IDS,
  compileLegacyPersona,
  compilePersonaLayers,
  compilePersonaSafety,
  compilePersonaTaskMode,
  compilePersonaVoice,
  getPersonaSchemaV1,
  getPersonaSchemaV2,
  listPersonaTaskModes,
  listPersonas,
} from "../src/index.js";

describe("public npm API", () => {
  it("re-exports the synchronous core API", () => {
    expect(listPersonas()).toHaveLength(BUILT_IN_PERSONA_IDS.length);
    expect(
      compilePersonaVoice("teacher", {
        locale: "en",
        intensity: "balanced",
        format: "text",
      }),
    ).toContain("Teacher");

    expect(compilePersonaSafety("teacher", { locale: "en" })).toContain("Teacher");
    const [mode] = listPersonaTaskModes("teacher", { locale: "en" });
    expect(mode).toBeDefined();
    expect(
      compilePersonaTaskMode("teacher", {
        locale: "en",
        taskModeId: mode?.id ?? "missing",
      }),
    ).toContain("Teacher");

    const layers = compilePersonaLayers("teacher", { locale: "en" });
    expect(layers.taskMode).toBeNull();
    expect(layers.voice.layer).toBe("voice");
    expect(layers.safety.layer).toBe("safety");
    expect(compileLegacyPersona("teacher", { locale: "en" })).toContain("Teacher");
    expect(getPersonaSchemaV1()).not.toBe(getPersonaSchemaV2());
  });
});
