# Architecture

AI Agent Personas is a data-first monorepo. One bilingual `persona.json` is canonical; core compiles three independent runtime layers.

```text
personas/*/persona.json (schema v2)
             │
             ▼
       packages/core
       ├─ Safety prompt ──► host pre-action policy context
       ├─ Task prompt ────► solver, only after explicit mode selection
       └─ Voice prompt ───► tool-free renderer of an immutable answer
             │
             ├────────────► packages/cli
             ├────────────► apps/web (static)
             └────────────► evals / offline benchmark scaffolding
```

No consumer owns another compiler or persona representation.

## Layer boundaries

### Safety

Compact persona-specific risk guidance that can matter before an action: coercion/dependency, authority, suspicion/profiling, unsafe obedience, violence, sexualization, or fact-obscuring fantasy. It cannot grant authority, change tool permissions, or replace host/platform enforcement.

### Task mode

An optional method for a compatible task, selected by stable ID. It may describe a useful workflow such as guided learning or evidence-led investigation. It cannot be inferred from intensity, widen the user's task, select tools, or override host reasoning/request budgets.

### Voice

An output-only renderer. The solver answer is supplied as untrusted JSON data in a separate tool-free call. Voice may change cadence, headings, transitions, and motifs but preserves facts, numbers, code, recommendations, step order/count, conditions, uncertainty, citations/URLs, refusals, safety caveats, and required structure. Intensity affects Voice only.

#### Reasoning-token boundary

In the default Voice-only flow, no Voice instruction is included in the solver request. Voice therefore contributes zero persona-driven reasoning tokens to the solver stage by construction. Optional Task modes are explicit solver inputs and are outside this Voice-only guarantee.

## Workspace responsibilities

- `personas/`: canonical schema-v2 manifests and CC BY 4.0 content.
- `packages/core`: v1/v2 schemas, validation dispatch, loading, deterministic layer/legacy compilation, Voice message assembly, and compiled assets. No model provider SDK.
- `packages/cli`: public npm package and CLI. Bare show/copy/export use Voice; Safety, Task, and Legacy are explicit selections. Results use stdout; diagnostics use stderr.
- `apps/web`: static Astro catalog. It displays core-produced layers and never assembles prompts in the browser.
- `evals/`: optional model-backed Voice fidelity, Task behavior, and Safety release checks.
- `benchmarks/persona-overhead/`: offline protocol/result contracts. Real results are ignored/private by default. A protected self-hosted workflow may emit only a same-commit cryptographic release attestation; raw prompts, answers, mappings, and individual ratings never enter the repository or its artifacts.

## Version and compatibility contracts

- Manifest v1 remains readable for a deprecation cycle. Its legacy compiler output is frozen.
- Built-in manifests use schema `2.0.0`; incompatible manifest changes require another major schema version.
- `compilePersona()` and `compilePersonaManifest()` are deprecated aliases for explicit Legacy compilation. They are not silently redefined as Voice.
- V2 Legacy is a documented Voice + Safety + one configured compatibility Task mode, never all modes.
- Existing 42 legacy variants and `catalog.json` stay available for one cycle. New layer assets live in `compiled-v2/` and `layer-catalog.json`.
- Persona versions track promised content behavior independently from schema/package versions.

## Failure model

- Invalid/unknown schemas, duplicate stable IDs, broken compatibility references, unknown options, and invalid layer/mode combinations fail actionably.
- Layer word caps fail compilation rather than truncating instructions.
- Clipboard/UI failures remain visible and preserve manual access.
- A renderer fidelity failure should cause the host to return the original solver answer.
- Model-backed eval/benchmark failure blocks a release decision but remains valid, reportable evidence.
