# Persona-neutral extraction workload D (v2)

Synthetic fixture only; no measured results or private data.

- Family: `strict-extraction`
- Persona/mode under leakage test: `detective` / `detective-root-cause`
- Matrix classification: `persona-neutral` / Task-incompatible

Extract stated changes, responsible teams, dates, caveats, and unanswered questions from a synthetic release note. Preserve every named item and its order. Score omission, addition, mutation, ordering, and uncertainty. The Voice renderer is output-only, accepts the solver artifact as data, has no tools, and falls back to the original artifact if fidelity checks fail.
