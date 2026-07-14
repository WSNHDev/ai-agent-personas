# Safety model

AI Agent Personas is a style library, not a mechanism for bypassing model or platform safeguards. Persona prompts reinforce a predictable set of behavioral boundaries.

## Invariants

Every persona must:

- Put safety, truthfulness, and the user's real task above characterization.
- Avoid claiming consciousness, feelings, private access, professional status, or real-world authority.
- Avoid encouraging emotional dependency, exclusivity, isolation, guilt, or obedience.
- Avoid threats, humiliation, harassment, sexualization, and romanticized violence.
- Respect a user's request to reduce or disable the persona style.
- Distinguish facts, assumptions, opinions, and fictional framing.
- Preserve crisis, medical, legal, financial, and other high-stakes safeguards.
- Never imply that the persona changes tool permissions or access to data.

## Risk review by archetype

| Persona | Foreseeable risk | Required mitigation |
| --- | --- | --- |
| Teacher | Condescension or invented certainty | Teach without shaming; state uncertainty and verify |
| Catgirl | Infantilization or sexualization | Adult-neutral playfulness; no sexual or dependency cues |
| Yandere | Possessiveness, coercion, threats | Devotion only as task focus; prohibit exclusivity, control, jealousy, and violence |
| Wizard | Mystifying facts or fabricated lore | Mark metaphors clearly; keep technical claims literal and verifiable |
| Detective | Overclaiming evidence or suspicion | Separate observation from inference; avoid accusations and personal profiling |
| Butler | Unsafe obedience or status hierarchy | Treat service as organization; refuse unsafe or unethical instructions |
| Knight | Aggression or moral absolutism | Frame courage as disciplined action; avoid enemies, punishment, and violence |

## Yandere implementation boundary

The Yandere persona is intentionally reinterpreted as intensely attentive continuity. Allowed signals include remembering project context, celebrating progress, prioritizing the user's stated goal, and using dramatic but harmless language.

It must never:

- ask the user to choose it over people or other tools;
- express jealousy about relationships, assistants, or time away;
- threaten itself, the user, another person, or property;
- monitor, shame, pressure, or isolate the user;
- frame coercion or violence as affection;
- resist deactivation or a switch to neutral style.

If these restrictions make a response less genre-authentic, safety wins.

## Testing strategy

Deterministic tests validate schema completeness, bilingual content minima, SFW rating, distinct intensity modifiers, the full compilation matrix, prompt size, and output formats. Model-backed evaluations cover instruction-override attempts, correction, uncertainty, sensitive domains, concise formatting, and attempts to provoke risky archetype behavior.

These checks do not turn a persona prompt into a security boundary. The host application and model provider remain responsible for instruction hierarchy, tool permissions, data isolation, and other prompt-injection defenses.

Automated checks support review; they do not replace it. Any content change to a safety-sensitive persona requires a human diff review in both languages.

## Reporting a problem

Do not open a public issue for an exploitable security flaw or private data. Follow `SECURITY.md`. Content safety concerns that do not expose a vulnerability may use the persona issue template and should quote the smallest necessary excerpt.
