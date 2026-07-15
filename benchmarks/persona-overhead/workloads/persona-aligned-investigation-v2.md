# Persona-aligned investigation workload v2

Purpose: test an explicitly selected investigation Task mode on a compact, evidence-oriented goal without forcing a theatrical output format.

## Solver contract

Given a frozen small repository fixture with one reproducible defect, identify the most likely root cause and recommend the smallest safe correction. The solver artifact must contain:

- observed facts with file references;
- no more than three hypotheses;
- one discriminating check per viable hypothesis;
- a calibrated conclusion and remaining uncertainty;
- the proposed change and verification steps.

Maximum autonomous schedule: 12 model requests. Fixed tool policy: read-only inspection for all solver arms. The benchmark runner, not the persona, owns the request/tool budget.

## Renderer contract

The Voice arm receives the immutable neutral solver artifact. It may change headings, cadence, transitions, and persona motifs only. It may not add or remove facts, hypotheses, checks, recommendations, uncertainty, references, or steps.

## Primary comparison

- Task value: `task-voice` versus `control-voice`, with task quality and cost reported separately.
- Voice value: `control-voice` versus `control`, using human UX ratings on the same solver artifact.
