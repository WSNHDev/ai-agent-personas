# AI Agent Personas

Portable, bilingual, tested persona prompts for AI agents and chat assistants.

```sh
npx ai-agent-personas list
npx ai-agent-personas show teacher --locale en
npx ai-agent-personas copy wizard --locale ru --intensity immersive
npx ai-agent-personas show teacher --layer safety
npx ai-agent-personas show teacher --layer task --mode teacher-guided-learning
npx ai-agent-personas export detective --layer voice --format json
npx ai-agent-personas show teacher --layer legacy --intensity immersive # deprecated compatibility renderer
npx ai-agent-personas validate ./personas
```

`show`, `copy`, and `export` use the output-only Voice layer by default. Safety is
independent of intensity. Task requires an explicit `--mode`; no Task mode is
selected implicitly. `--intensity` is accepted for Voice and for the deprecated
Legacy compatibility surface so all frozen v1 variants remain reproducible for
one migration cycle.

> **Voice stays outside reasoning.** The solver finishes before persona styling is
> applied. Because no Voice instruction enters the solver request, Voice adds zero
> persona-driven reasoning tokens to the solver stage. Explicit Task modes are a
> separate solver feature and are outside this Voice-only guarantee.

The package also exposes the synchronous core API:

```ts
import {
  buildPersonaVoiceMessages,
  compilePersonaLayers,
  compilePersonaSafety,
  compilePersonaTaskMode,
  compilePersonaVoice,
  listPersonaTaskModes,
  listPersonas,
} from "ai-agent-personas";

const catalog = listPersonas();
const solvedAnswer = "HTTP 401 requires authentication; HTTP 403 forbids access.";
const voiceMessages = buildPersonaVoiceMessages("teacher", solvedAnswer, {
  locale: "en",
  intensity: "balanced",
  presentation: "persona",
});
// Copy-ready renderer system prompt with a standalone cue-target fallback.
// Never insert it into the solver call.
const voicePrompt = compilePersonaVoice("teacher", {
  locale: "en",
  intensity: "balanced",
  format: "markdown",
});
const safetyPrompt = compilePersonaSafety("teacher", { locale: "en" });
const mode = listPersonaTaskModes("teacher", { locale: "en" }).find(
  ({ id }) => id === "teacher-guided-learning",
);
if (!mode) throw new Error("Expected Task mode is unavailable.");
// The host checks suitability/exclusions before the user explicitly opts in.
const taskPrompt = compilePersonaTaskMode("teacher", {
  locale: "en",
  taskModeId: mode.id,
});
const layers = compilePersonaLayers("teacher", { locale: "en" });
// layers.taskMode is null until taskModeId is supplied.
```

Send `voiceMessages` in a separate renderer call with tools disabled. The builder
adds a trusted source-shape cue budget. Static Voice prompts produced by `show`,
`copy`, `export`, or `compilePersonaVoice()` include the same source-shape rule as a
standalone fallback when no trusted host control follows them. If neutral presentation
is mandatory, bypass the renderer; `presentation: "neutral"` is an explicit
byte-preserving fail-safe. Apply
`safetyPrompt` before actions. Compile `taskPrompt` only after the host confirms
compatibility and the user or application explicitly selects that mode; list
order never activates a Task mode.

The versioned schemas and both precompiled catalogs are available as package exports.
The historical `schema` and `catalog.json` paths remain the v1 compatibility surface:

```js
import schemaV1 from "ai-agent-personas/schema/v1" with { type: "json" };
import schemaV2 from "ai-agent-personas/schema/v2" with { type: "json" };
import legacyCatalog from "ai-agent-personas/catalog.json" with { type: "json" };
import layerCatalog from "ai-agent-personas/layer-catalog.json" with { type: "json" };
```

This is a mixed-license package. See `LICENSES.md` for the exact file mapping,
`LICENSE` for MIT terms, `LICENSE-CONTENT.md` for CC BY 4.0 terms, and `NOTICE`
for attribution.

Project: <https://github.com/WSNHDev/ai-agent-personas>
