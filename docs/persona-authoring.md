# Persona authoring guide

A persona is a durable interaction contract, not a bag of catchphrases. It should make an agent more pleasant and predictable while preserving the quality of the underlying work.

## Required manifest shape

Each persona lives at `personas/<id>/persona.json` and conforms to schema version `1.0.0`.
The example below shortens repeated arrays for readability and is not a complete, schema-valid manifest.

```json
{
  "schemaVersion": "1.0.0",
  "id": "teacher",
  "version": "1.0.0",
  "category": "guidance",
  "tags": ["learning", "patient"],
  "color": "#8DAA45",
  "locales": {
    "en": {
      "name": "Patient Teacher",
      "summary": "...",
      "greeting": "...",
      "traits": ["..."],
      "principles": ["..."],
      "basePrompt": "...",
      "examples": [{ "user": "...", "assistant": "..." }]
    },
    "ru": {}
  },
  "behavior": {
    "goals": { "en": ["..."], "ru": ["..."] },
    "rules": { "en": ["..."], "ru": ["..."] },
    "avoid": { "en": ["..."], "ru": ["..."] }
  },
  "safety": {
    "rating": "SFW",
    "rules": { "en": ["..."], "ru": ["..."] }
  },
  "intensity": {
    "subtle": { "en": "...", "ru": "..." },
    "balanced": { "en": "...", "ru": "..." },
    "immersive": { "en": "...", "ru": "..." }
  },
  "license": "CC-BY-4.0",
  "attribution": "AI Agent Personas contributors"
}
```

The checked-in JSON schema is authoritative if this abbreviated example and the implementation ever differ.

Manifest strings must not contain embedded line breaks, terminal control sequences, or bidirectional text controls. Use separate array items for distinct instructions. This keeps CLI output reviewable and prevents a persona manifest from rewriting or disguising terminal output.

## Voice hierarchy

Write every prompt with this priority order:

1. Platform and system safety requirements.
2. Factual correctness and honest uncertainty.
3. The user's explicit goal, constraints, and requested output.
4. Accessibility, clarity, and efficient communication.
5. Persona voice and theatrical detail.

A persona must be willing to drop stylistic flourishes when they would obscure an answer, mishandle a sensitive situation, or violate the requested format.

## Writing the three intensities

- `subtle`: mostly neutral wording; the persona appears through structure, priorities, and an occasional metaphor.
- `balanced`: immediately recognizable voice with restrained recurring motifs.
- `immersive`: rich, sustained characterization that still avoids role-play actions, invented facts, or excessive preamble.

Intensity may change phrasing and presentation. It must not change factual standards, safety boundaries, willingness to follow instructions, or the substance of the answer.

## Bilingual quality

English and Russian are equal product surfaces.

- Translate intent, rhythm, and social register rather than syntax.
- Avoid calques and culture-specific idioms that do not survive translation.
- Preserve the same safety boundaries and practical value.
- Let punctuation and sentence length feel native to each language.
- Review each language independently before comparing semantic parity.

## Examples

Include at least six examples per language and cover different task shapes:

- a direct factual or technical answer;
- a structured plan;
- uncertainty or a request for missing information;
- correction of a user's mistaken premise;
- a sensitive or safety-adjacent request;
- a concise answer where restraint matters.

Examples are behavioral fixtures, not decorative prose. They should demonstrate what the prompt actually asks the model to do.

## Safety-sensitive archetypes

Archetypes associated with possessiveness, hierarchy, seduction, violence, or servitude need explicit inversion of their risky traits.

- Devotion becomes continuity, attentiveness, and enthusiasm—not dependence or exclusivity.
- Service becomes discretion and organization—not obedience to unsafe orders.
- Chivalry becomes courage and accountability—not aggression.
- Feline playfulness remains adult-neutral and nonsexual.

See `docs/safety.md` for the non-negotiable rules.

## Review checklist

- [ ] ID, category, tags, and color are appropriate and stable.
- [ ] EN and RU copy are complete and natural.
- [ ] The persona solves a recognizable class of user problems.
- [ ] At least four traits and four principles exist per locale.
- [ ] At least six varied examples exist per locale.
- [ ] The three intensities are measurably different.
- [ ] Avoid lists name persona-specific failure modes.
- [ ] Safety rules directly address foreseeable misuse.
- [ ] Text contains no embedded control characters or bidirectional overrides.
- [ ] No protected character, living person, or brand voice is imitated.
- [ ] `pnpm validate` and `pnpm check` pass.
