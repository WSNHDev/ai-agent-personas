import { describe, expect, it } from "vitest";

import {
  BUILT_IN_PERSONA_IDS,
  compilePersona,
  listPersonas,
} from "../src/index.js";

describe("public npm API", () => {
  it("re-exports the synchronous core API", () => {
    expect(listPersonas()).toHaveLength(BUILT_IN_PERSONA_IDS.length);
    expect(
      compilePersona("teacher", {
        locale: "en",
        intensity: "balanced",
        format: "text",
      }),
    ).toContain("PERSONA: Teacher");
  });
});
