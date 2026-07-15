# AI Agent Personas

An open-source, safety-aware persona library designed to give finished AI answers a distinctive voice through a separate output-only renderer, without asking the solver to change how it reasons or acts.

[Русская версия](README.ru.md)

> Layered preview: schema v2 separates output Voice, optional Task modes, and pre-action Safety. The deprecated v1-style global prompt remains available only as an explicit migration surface for one migration cycle.

## Reasoning stays neutral

> [!IMPORTANT]
> **Voice stays outside reasoning.** The solver completes the task before persona styling is applied. Because no Voice instruction enters the solver request, Voice adds **0 persona-driven reasoning tokens to the solver stage**.

| 01 · Neutral solver | 02 · Completed answer | 03 · Persona Voice |
| --- | --- | --- |
| Solves the user's task under its own reasoning budget. | Becomes the renderer's fixed source of truth. | Changes presentation only, after the solution exists. |

Optional Task modes are a separate, explicit feature. They can enter the solver only after the application selects a compatible mode; the zero-impact statement above applies specifically to output-only Voice.

## What is included

- Seven original archetypes: Teacher, Catgirl, Yandere, Wizard, Detective, Butler, and Knight.
- English and Russian copy for every persona.
- Three Voice intensities: `subtle`, `balanced`, and `immersive`; intensity never changes Task or Safety.
- Explicit, opt-in Task modes for compatible work.
- Compact persona-specific Safety guidance that cannot grant tools or override host policy.
- Framework-neutral layer compilation and a provider-neutral two-message Voice renderer.
- A typed library API and CLI in one npm package, plus a static Astro catalog.
- Schema validation, unit tests, safety rules, and optional Promptfoo evaluations.

Voice is presentation-only: the solver produces the answer first, then the renderer may change cadence, headings, and motifs while preserving substance and required structure.

## Quick start

Requirements: Node.js 24+ and pnpm 11+.

```bash
pnpm install
pnpm check
pnpm dev
```

After the npm package is published:

```bash
npx ai-agent-personas list
npx ai-agent-personas show teacher --layer voice --locale en --intensity balanced
npx ai-agent-personas show detective --layer safety --locale ru
npx ai-agent-personas copy wizard --layer voice --locale en --intensity immersive
npx ai-agent-personas export butler --layer voice --locale en --output butler-voice.txt
npx ai-agent-personas validate
```

Use the package programmatically:

```ts
import { buildPersonaVoiceMessages } from 'ai-agent-personas';

const solvedAnswer = 'HTTP 401 means authentication is required; 403 means access is forbidden.';
const messages = buildPersonaVoiceMessages('teacher', solvedAnswer, {
  locale: 'en',
  intensity: 'balanced',
  presentation: 'persona',
});
```

Send `messages` in a separate renderer call without tools. The builder computes the cue budget from the source answer in trusted host control; use `presentation: 'neutral'` only as a fail-safe and bypass the renderer entirely when neutral output is required. CLI and website Voice copies are standalone renderer system prompts with the same source-shape rule as a fallback when no trusted host control follows them. Never place a Voice prompt in the solver call. Use `compilePersonaSafety()` before actions and `compilePersonaTaskMode()` only when the application explicitly selects a compatible mode. `compilePersona()` remains a deprecated legacy alias and should not be used in new integrations.

## Personas

| ID | Character | Compatible explicit Task-mode uses |
| --- | --- | --- |
| `teacher` | Patient Teacher | Learning, explanation, feedback, practice |
| `catgirl` | Playful Catgirl | Friendly assistance, brainstorming, casual workflows |
| `yandere` | Devoted Yandere | Intense but safe focus, encouragement, continuity |
| `wizard` | Arcane Wizard | Exploration, systems thinking, creative problem solving |
| `detective` | Exacting Detective | Investigation, debugging, evidence synthesis |
| `butler` | Discreet Butler | Organization, planning, polished assistance |
| `knight` | Steadfast Knight | Execution, accountability, principled decisions |

The final column describes optional Task modes, not automatic Voice behavior. Voice can render any completed answer and never selects or changes the solver method.

These are original archetypes, not replicas of specific copyrighted characters or living people.

## Repository map

```text
apps/web/           Static Astro catalog and persona pages
packages/core/      Schema, validation, catalog loading, prompt compiler
packages/cli/       `ai-agent-personas` command-line interface
personas/           Canonical bilingual persona manifests
evals/              Optional Promptfoo quality and safety evaluations
design/             Visual references used to build the website
docs/               Architecture, authoring, safety, and release guides
```

## Quality contract

Every accepted persona must:

1. Keep Voice free of reasoning, tool, authorization, and scope-changing instructions.
2. Preserve facts, code, recommendations, steps, uncertainty, citations, refusals, and requested structure.
3. Make every Task mode explicit, suitable for a named class of work, and optional.
4. Keep Safety persona-specific while leaving enforcement to the host.
5. Work naturally in English and Russian at all three Voice intensities.
6. Avoid coercion, dependency cues, harassment, sexualization, threats, and impersonation.
7. Pass schema, isolation, package, website, and offline benchmark tests.

See [Persona authoring](docs/persona-authoring.md), [Safety model](docs/safety.md), and [Evaluation strategy](docs/evaluation.md) before proposing content.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Persona proposals use the issue template so voice, utility, safety, translations, and evaluation cases can be reviewed independently.

## Licensing

- Source code is licensed under the [MIT License](LICENSE).
- Persona text, documentation prose, and original visual assets are licensed under [CC BY 4.0](LICENSE-CONTENT).
- Attribution details are recorded in [NOTICE](NOTICE).

## Status and roadmap

Preview progress and the path to a stable API live in [ROADMAP.md](ROADMAP.md). Raw model outputs, private prompts, evaluator mappings, and individual ratings are never committed. Only aggregate fidelity/UX/safety claims may be published after separate authorization and reproducibility, privacy, and statistical review. npm publication remains an explicit release operation.
