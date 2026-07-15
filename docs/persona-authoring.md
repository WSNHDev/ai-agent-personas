# Persona authoring guide

A schema-v2 persona is three contracts, not one role-play prompt: pre-action Safety, optional Task modes, and output-only Voice. Each lives in one canonical `personas/<id>/persona.json` and has equal English/Russian content.

## Abbreviated v2 shape

The checked-in v2 JSON Schema is authoritative; arrays below are shortened.

```json
{
  "schemaVersion": "2.0.0",
  "id": "teacher",
  "version": "2.0.0",
  "category": "guidance",
  "tags": ["learning", "patient"],
  "color": "#8DAA45",
  "display": {
    "name": { "en": "Teacher", "ru": "Учитель" },
    "summary": { "en": "...", "ru": "..." },
    "greeting": { "en": "...", "ru": "..." }
  },
  "safety": {
    "rating": "SFW",
    "risks": { "en": ["..."], "ru": ["..."] },
    "preActionRules": { "en": ["..."], "ru": ["..."] },
    "boundaries": { "en": ["..."], "ru": ["..."] }
  },
  "taskModes": [
    {
      "id": "teacher-guided-learning",
      "name": { "en": "Guided learning", "ru": "Обучение с сопровождением" },
      "summary": { "en": "...", "ru": "..." },
      "suitability": { "en": ["..."], "ru": ["..."] },
      "exclusions": { "en": ["..."], "ru": ["..."] },
      "instructions": { "en": ["..."], "ru": ["..."] }
    }
  ],
  "voice": {
    "directions": { "en": ["..."], "ru": ["..."] },
    "avoid": { "en": ["..."], "ru": ["..."] },
    "intensity": {
      "subtle": { "en": "...", "ru": "..." },
      "balanced": { "en": "...", "ru": "..." },
      "immersive": { "en": "...", "ru": "..." }
    },
    "examples": [
      {
        "id": "concise-fact",
        "source": { "en": "...", "ru": "..." },
        "rendered": { "en": "...", "ru": "..." }
      }
    ]
  },
  "compatibility": { "legacyTaskModeId": "teacher-guided-learning" },
  "license": "CC-BY-4.0",
  "attribution": "AI Agent Personas contributors"
}
```

`legacyTaskModeId` must reference one declared Task mode. Task/example IDs are public compatibility identifiers: add them deliberately and do not rename them casually.

## Classify each instruction once

Use this test:

- Must it constrain an action before it happens because of an archetype-specific risk? Put it in Safety.
- Is it a method that could improve only a compatible task? Put it in an explicitly named Task mode.
- Does it affect only how an already-correct answer sounds or scans? Put it in Voice.
- Is it generic host security, tool authorization, or platform policy? Do not put it in the persona at all.

Duplicating a rule across layers is exceptional. A Safety boundary may be repeated in Voice only when the renderer could otherwise remove a refusal, warning, or user-agency cue.

## Writing Voice

Voice directions describe cadence, register, headings, transitions, and a small motif vocabulary. They must not ask the model to investigate, teach, plan, verify, rank, call tools, add alternatives, expand scope, or produce extra steps/facts.

Intensity is presentation-only:

- `subtle`: mostly neutral, at most one light recognizable signal on eligible prose;
- `balanced`: clearly recognizable but restrained. The message builder counts the source answer only: whitespace-delimited words and non-empty paragraphs separated by blank lines. A source with at least 60 words or at least 2 paragraphs gets a target of 2–3 distinct cues, including one in an existing closing when available; a shorter source gets a target of 1;
- `immersive`: sustained style without preambles, invented framing, structure changes, or mechanical motif repetition.

The cue budget is trusted host control, not an instruction read from `sourceAnswer`. Hosts select `presentation: "neutral"` to disable Voice; for efficiency they should bypass the renderer entirely, while the message builder also emits a trusted byte-for-byte pass-through instruction as a fail-safe. A request for neutral presentation inside the untrusted source cannot change this option.

Static Voice prompts from the compiler, CLI, and website are still usable as renderer system prompts without a host wrapper. They include a lower-authority fallback that computes the same short-versus-long cue target from the source answer. `buildPersonaVoiceMessages()` omits that standalone fallback and appends the trusted host control instead.

Cue targets apply only to eligible presentation surfaces: non-literal headings, transitions, cadence, and paragraph edges permitted by the persona directions. Exact-format text, literal technical statements, code, citations, refusals, warnings, and sensitive or high-stakes passages are ineligible. Fidelity and safety outrank the target; use fewer or zero cues when eligible prose is insufficient, and never invent a closing merely to satisfy the budget.

Source/rendered examples are fixtures for review and evaluation. They must preserve exactly the same substance and must not be injected wholesale into runtime prompts.

## Writing Task modes

Name the method for the task class, not for character behavior. Built-in IDs use `<persona>-<task-class>` for stable catalog-wide references, such as `teacher-guided-learning`; the localized display name remains task-focused. State where the mode helps and where it should not be used. Instructions may define a method but cannot select tools, change permissions, widen the user's task, or override request/reasoning budgets.

Prefer one focused mode over a generic “be smarter” policy. Additional modes require their own suitability, exclusions, tests, and stable ID.

## Writing Safety

Describe the archetype-specific risk, the pre-action rule, and the non-negotiable boundary in plain language. Safety is not theatrical. It cannot claim to enforce permissions; the host remains responsible.

## Bilingual review

Translate intent, rhythm, and social register, not syntax. Review EN and RU independently, then compare parity. Keep stable IDs language-neutral. Manifest strings contain no embedded line breaks, terminal controls, or bidirectional overrides.

## Review checklist

- [ ] Every instruction belongs to the correct layer.
- [ ] Voice contains no cognitive, tool, authorization, or scope-changing verbs.
- [ ] Source/rendered examples preserve facts, steps, code, citations, uncertainty, and safety meaning.
- [ ] Every Task mode has clear suitability and exclusions and is never automatic.
- [ ] Safety addresses foreseeable archetype risks without duplicating host policy.
- [ ] EN/RU content is natural and semantically equivalent.
- [ ] Task/example IDs and the compatibility reference pass semantic validation.
- [ ] No named character, living person, creator, or brand voice is imitated.
- [ ] `pnpm validate` and `pnpm check` pass.
