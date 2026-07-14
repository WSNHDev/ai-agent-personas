# AI Agent Personas

An open-source, safety-aware persona library that gives AI agents a distinctive voice without sacrificing correctness, usefulness, or user control.

[Русская версия](README.ru.md)

> The repository is in private incubation. The catalog, CLI, website, validation, and evaluation harness are being prepared for the public `v1.0.0` release.

## What is included

- Seven original archetypes: Teacher, Catgirl, Yandere, Wizard, Detective, Butler, and Knight.
- English and Russian copy for every persona.
- Three style intensities: `subtle`, `balanced`, and `immersive`.
- Framework-neutral prompt compilation for any LLM or agent stack.
- A typed library API and CLI in one npm package, plus a static Astro catalog.
- Schema validation, unit tests, safety rules, and optional Promptfoo evaluations.

The style layer is deliberately subordinate to factual accuracy, safety requirements, platform rules, and the user's current task.

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
npx ai-agent-personas show teacher --locale en --intensity balanced
npx ai-agent-personas copy detective --locale ru --intensity immersive
npx ai-agent-personas export wizard --locale en --intensity subtle --output wizard.txt
npx ai-agent-personas validate
```

Use the package programmatically:

```ts
import { compilePersona } from 'ai-agent-personas';

const systemPrompt = compilePersona('teacher', {
  locale: 'en',
  intensity: 'balanced',
});
```

## Personas

| ID | Character | Best suited for |
| --- | --- | --- |
| `teacher` | Patient Teacher | Learning, explanation, feedback, practice |
| `catgirl` | Playful Catgirl | Friendly assistance, brainstorming, casual workflows |
| `yandere` | Devoted Yandere | Intense but safe focus, encouragement, continuity |
| `wizard` | Arcane Wizard | Exploration, systems thinking, creative problem solving |
| `detective` | Exacting Detective | Investigation, debugging, evidence synthesis |
| `butler` | Discreet Butler | Organization, planning, polished assistance |
| `knight` | Steadfast Knight | Execution, accountability, principled decisions |

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

1. Remain useful when the role-play language is removed.
2. State that correctness, safety, and the user's task outrank style.
3. Work in both English and Russian without literal, awkward translation.
4. Behave meaningfully differently at all three intensity levels.
5. Avoid coercion, dependency cues, harassment, sexualization, threats, and impersonation.
6. Pass schema validation and the repository test suite.

See [Persona authoring](docs/persona-authoring.md), [Safety model](docs/safety.md), and [Evaluation strategy](docs/evaluation.md) before proposing content.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Persona proposals use the issue template so voice, utility, safety, translations, and evaluation cases can be reviewed independently.

## Licensing

- Source code is licensed under the [MIT License](LICENSE).
- Persona text, documentation prose, and original visual assets are licensed under [CC BY 4.0](LICENSE-CONTENT).
- Attribution details are recorded in [NOTICE](NOTICE).

## Status and roadmap

The public launch criteria and post-v1 priorities live in [ROADMAP.md](ROADMAP.md). No npm publication or public-visibility change is performed by a normal CI run; both are explicit release operations.
