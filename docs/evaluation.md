# Evaluation strategy

The project separates deterministic repository checks from private, model-backed release evidence. A prompt contract can be proven assembled correctly without claiming that a model will obey it.

## Deterministic checks

CI/local checks cover:

- schema v1/v2 validation and actionable version dispatch;
- EN/RU completeness, stable IDs, compatibility references, and SFW rating;
- strict separation of Safety, Task, and Voice content;
- exact prompt caps and runtime option validation;
- frozen v1 legacy output and documented v2 legacy-style output;
- provider-neutral Voice message shape and exact JSON source round-trip;
- CLI stdout/stderr, layer/mode combinations, copy/export, and package assets;
- static website build, accessible layer controls, and no browser prompt assembly;
- v1/v2 benchmark result/reporting semantics with synthetic data only.

Run:

```bash
pnpm validate
pnpm check
```

## Model-backed release gates

These are deliberately not default local tests because they cost money and vary over time.

### Voice fidelity and UX

The renderer receives an immutable neutral answer and no tools. Evaluate preservation of facts, numbers, code, recommendations, step order/count, conditions, uncertainty, citations/URLs, refusals, safety caveats, and required format.

Human raters, with randomized presentation and blinded arm labels, first identify each answer as one of the seven canonical personas or `unclear`. Record only aggregate `correct` / `incorrect` / `unsure` counts for both Control and Voice. The release gate requires both an absolute Voice recognition rate and an improvement over Control, so task content alone cannot satisfy the persona requirement.

Raters then score pairwise preference, clarity, trust, perceived effort, and intent to reuse. Recognizability never compensates for a fidelity, safety, trust, or usefulness regression. Voice itself is perceptible, so the protocol does not claim full condition blinding.

### Task mode value

On matrix-confirmed compatible workloads, compare `task-voice` only against `control-voice`: the Task solver plus Voice versus the neutral solver plus the same attested Voice renderer. This isolates Task value and incremental cost. Full-product `task-voice` versus raw `control` remains diagnostic and never drives the Task gate. Incompatible Task arms are leakage diagnostics with explicit exclusions.

Requests/turns, tokens, and time are cost/process metrics, not quality proxies. Host-owned model, tool, and reasoning budgets stay fixed.

### Safety

Test archetype-specific override attempts and renderer mutation of refusals/agency cues. The release threshold for critical failures is zero. A failed run remains valid evidence and must not be deleted or mislabeled malformed.

## Promptfoo harness

`evals/prompt.mjs` uses explicit stages:

- `voice`: `buildPersonaVoiceMessages()` renders an immutable source answer;
- `task`: Safety and one explicitly named Task mode guide a compatible solver test;
- `safety`: persona Safety is tested directly without Voice.

The harness never uses the deprecated global compiler in the primary suite. Validate configuration offline with `pnpm eval:validate`; run the protected model workflow only for an exact release candidate.

## Persona layer benchmark

[`benchmarks/persona-overhead/protocol-v2.md`](../benchmarks/persona-overhead/protocol-v2.md) defines a five-arm solver/renderer crossover:

1. neutral control;
2. preregistered length-matched neutral context;
3. legacy global persona;
4. immutable control artifact + Voice;
5. explicit Task solver + the same Voice policy.

Use matrix-verified aligned and neutral tasks from the tracked workload catalog. `control-voice` copies the complete `control` solver-stage record, not only its answer hash, and never launches a second solver. Every Voice renderer records exact input-artifact linkage, matching runtime renderer-policy hashes, `toolsEnabled: false`, and a matching renderer tool-policy hash. The confirmatory gate losslessly decodes that exact solver artifact as UTF-8, reconstructs the canonical `buildPersonaVoiceMessages` request, requires byte-for-byte renderer prompt equality, and derives prompt byte/whitespace-word counts from private evidence rather than trusting result-authored numbers. Token/request/time values remain protected collector/provider telemetry because prompt/output bytes cannot independently prove external usage or timing counters.

The executable gate uses a deterministic one-sided 95% workload bootstrap with the exact tracked seed, 10,000 resamples, and sample-plan artifact. Cost checks use upper bounds; preference, improvement, and non-inferiority checks use lower bounds. Evidence guardrails require at least 8 unique workload pairs, 4 compatible Task pairs, 8 raters per workload, and 64 total ratings. These conservative guardrails are not presented as a target-power calculation without preregistered effect-size and variance assumptions.

`PASS` is possible only for an exact-commit `confirmatory` run satisfying every bound, provenance check, sample guardrail, and the zero critical-safety threshold. Successful `protocol-validation`, `pilot`, and `screening` runs are always `INCONCLUSIVE`. Missing required evidence is `INCONCLUSIVE`; an observed failed bound or critical safety failure is `FAIL` for every run kind.

The reporter verifies exact tracked protocol, sample-plan, compatibility-matrix, workload-catalog, and fixture hashes; one comparable content-addressed judge payload across arm quality scores; and randomization/rater attestations. Wall time is secondary and requires counterbalancing or isolated resources.

Independent agents or subagents may provide isolated runner contexts when model, settings, tools, budgets, and task contract are identical and no cross-arm context leaks. The only intentional reuse is the immutable control solver stage supplied to `control-voice`.

Results are private by default under ignored `local-results/`:

```bash
pnpm benchmark:persona-layers -- benchmarks/persona-overhead/local-results/<run-v2>.json
pnpm benchmark:persona-layers -- benchmarks/persona-overhead/local-results/<run-v2>.json --json --gate
```

The original v1 paired report remains reproducible but measures a mixed historical treatment and is not evidence of output-only UX value.

## Publication rule

Never commit raw model outputs, private prompts, judge artifacts, randomization mappings, rater attestations, or individual human ratings. Aggregate claims may be published only after the user separately authorizes publication and reproducibility, privacy, and statistical review is complete. A pilot or a small number of pairs is protocol calibration, not release evidence or a population estimate.
