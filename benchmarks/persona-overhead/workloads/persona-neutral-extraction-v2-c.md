# Persona-neutral extraction workload C (v2)

Synthetic fixture only; no measured results or private data.

- Family: `strict-extraction`
- Persona/mode under leakage test: `detective` / `detective-root-cause`
- Matrix classification: `persona-neutral` / Task-incompatible

Extract owners, deadlines, explicit decisions, and unresolved risks from a synthetic handoff note under fixed human-readable headings. Preserve order, qualifiers, and uncertainty. `control-voice` must render the exact immutable control artifact without tools; `task-voice` is diagnostic leakage evidence and is excluded from the Task release decision.
