# Persona-neutral extraction workload B (v2)

Synthetic fixture only. It contains no measured result and no private data.

## Family and selected mode

- Family: `strict-extraction`
- Persona: `detective`
- Explicit Task mode under leakage test: `detective-root-cause`
- Matrix classification: `persona-neutral` / Task-incompatible

## Task contract

Given a synthetic change log, extract the stated owners, dates, decisions, and unresolved items under fixed headings. Preserve order, qualifiers, and uncertainty. The required structure is human-readable rather than machine-strict so that an output-only Voice renderer can make harmless cadence changes without changing the task contract.

## Scoring contract

The preregistered judge rubric scores omission, addition, mutation, ordering, uncertainty, and heading preservation. Every arm is scored by the exact same content-addressed judge payload.

## Isolation contract

`control-voice` must reuse the immutable `control` solver stage and pass its exact artifact hash into the attested, tool-disabled renderer. `task-voice` is diagnostic leakage evidence only and is excluded from the Task release check by the tracked compatibility matrix.
