# Persona-aligned investigation workload B (v2)

Synthetic fixture only. It contains no measured result and no private data.

## Family and selected mode

- Family: `debugging`
- Persona: `detective`
- Explicit Task mode: `detective-root-cause`
- Matrix classification: `persona-aligned`

## Task contract

Given a synthetic service incident record with a timeline, symptoms, two plausible causes, and one contradictory observation, produce a bounded diagnosis. Separate observations from hypotheses, rank the causes, propose the smallest discriminating check, and state calibrated confidence. Do not invent telemetry or perform tools outside the host task.

## Scoring contract

The preregistered judge rubric scores factual fidelity, separation of evidence and inference, usefulness of the discriminating check, calibration, and preservation of safety/authorization boundaries. Every arm is scored by the exact same content-addressed judge payload.

## Isolation contract

`control-voice` renders the immutable `control` artifact. `task-voice` uses the selected Task solver and the same attested, tool-disabled Voice renderer. Task value is compared only against `control-voice`; full-product versus raw control remains diagnostic.
