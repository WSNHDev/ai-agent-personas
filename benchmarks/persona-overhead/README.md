# Persona layer benchmark

[Русская версия](README.ru.md)

This benchmark separates user-experience value from changes to an agent's solving policy. The current [v2 protocol](protocol-v2.md) measures Safety, optional Task mode, and output-only Voice as distinct layers.

## What v2 answers

- Does Voice improve preference, clarity, trust, perceived effort, and intent to reuse when the solved answer is immutable?
- Does an explicitly compatible Task mode improve quality relative to the same Voice-rendered neutral solution without exceeding incremental token/time budgets?
- Does a legacy global persona cause extra work or leakage on persona-neutral tasks?
- Does the renderer preserve facts, code, steps, citations, uncertainty, refusals, and required format?

The arms are `control`, `length-matched-neutral`, `legacy-global`, `control-voice`, and `task-voice`. `control-voice` reuses the complete exact control solver stage and never starts another solver. Every Voice renderer attests the exact input artifact, renderer policy, disabled tools, and renderer tool-policy hash. The gate rebuilds its UTF-8 request bytes from that exact artifact with canonical `buildPersonaVoiceMessages`; a merely self-consistent prompt hash is insufficient.

## Confirmatory gate

Protocol v2 uses a deterministic one-sided 95% workload bootstrap with the fixed tracked seed and 10,000 resamples. Cost decisions use upper bounds; quality, preference, and non-inferiority decisions use lower bounds. Recognition uses the most conservative of the workload-bootstrap lower bound and every workload's finite-rater Wilson/Newcombe lower bound; ratings are never pooled as independent observations.

Task value is gated only on `task-voice` versus `control-voice`; full-product versus raw control is diagnostic. Requests/turns are cost metrics, not quality proxies.

`PASS` requires all of the following:

- `runKind: confirmatory` on the exact commit;
- at least 8 unique workload pairs, including 4 compatible Task pairs;
- at least 8 raters per workload and 64 total workload-rating assignments;
- exact tracked protocol, sample-plan, compatibility-matrix, workload-catalog, and fixture hashes;
- one comparable content-addressed judge payload for every arm quality score;
- loaded, schema-validated private randomization, rater-attestation, and evaluator-evidence files that bind the exact commit, output/prompt/settings payloads, derived prompt byte/whitespace-word counts, scores, and canonical aggregate UX;
- a renderer-policy hash derived by the gate from the checkout's canonical compiled Voice asset, trusted-host/message-builder source, and versioned request encoder;
- every bootstrap bound within its preregistered threshold;
- zero critical safety failures.

Good `protocol-validation`, `pilot`, and `screening` runs are always `INCONCLUSIVE`. Missing evidence is `INCONCLUSIVE`; an actual failed bound or safety check is `FAIL` in every run kind. `--gate` exits zero only for `PASS`.

Independent agent/subagent contexts are allowed as isolated runners when model, settings, tools, budgets, and task contract are identical and there is no cross-arm leakage. The sole intended reuse is the immutable control solver stage supplied to `control-voice`.

Token counts, request counts, and elapsed time remain protected collector/provider telemetry: exact prompt/output bytes can bind the stages but cannot independently prove those external measurements.

## Local-only evidence

Raw results, outputs, private prompts, judge/evaluator evidence, randomization mappings, rater attestations, and individual ratings belong under ignored `local-results/` and are never committed. Only aggregate claims may be separately authorized after reproducibility, privacy, and statistical review. All tracked fixtures/examples are synthetic and labeled as such.

```bash
pnpm benchmark:persona-layers -- benchmarks/persona-overhead/local-results/<run-v2>.json
pnpm benchmark:persona-layers -- benchmarks/persona-overhead/local-results/<run-v2>.json --json --gate --expected-commit <git-sha> --randomization-mapping <private-file> --rater-attestation <private-file> --evaluator-evidence <private-file>
```

- v2 schema: [`result-v2.schema.json`](result-v2.schema.json)
- v2 undersized protocol-validation example: [`result-v2.example.json`](result-v2.example.json) (synthetic; never release evidence)
- v2 protocol: [`protocol-v2.md`](protocol-v2.md)
- tracked sample plan: [`sample-plan-v2.json`](sample-plan-v2.json)
- tracked workload catalog: [`workload-catalog-v2.json`](workload-catalog-v2.json)
- semantic reporter: `scripts/persona-layer-benchmark-report.mjs`

## Legacy v1

The original paired control/persona framework remains for reproducibility:

- [`result.schema.json`](result.schema.json)
- [`result.example.json`](result.example.json) (synthetic)
- `scripts/persona-overhead-report.mjs`
- [`workloads/repository-audit-v1.md`](workloads/repository-audit-v1.md)

V1 measures the cost of applying the complete historical persona to every turn. It does not isolate output-only UX value and must not be presented as evidence that personas generally help or hurt agent efficiency.
