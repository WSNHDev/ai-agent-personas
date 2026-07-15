# Persona layer benchmark protocol v2

This protocol measures two separate product questions:

1. Does output-only Voice improve the experience of the same solved answer?
2. Does an explicitly selected Task mode improve a compatible task enough to justify its incremental cost?

It does not treat a monolithic persona prompt as the default product. Real runs, raw outputs, private prompts, randomization mappings, rater-level data, and evaluator artifacts stay under ignored `local-results/` and are never committed by this workflow.

## Five registered arms

| ID | Solver | Renderer | Purpose |
| --- | --- | --- | --- |
| `control` | Neutral task contract | Neutral | Baseline |
| `length-matched-neutral` | Neutral prose matched to the legacy solver prompt by preregistered whitespace word count | Neutral | Context-length diagnostic |
| `legacy-global` | Deprecated global persona prompt | Neutral | Historical mixed-treatment diagnostic |
| `control-voice` | Exact immutable `control` solver stage | Output-only Voice | Isolated Voice value |
| `task-voice` | Explicit compatible Task mode | The same output-only Voice policy | Layered product value |

`control` and `control-voice` reuse the complete identical solver-stage record: artifact and prompt hashes, prompt size, request count, token counters, and elapsed time. `control-voice` never launches a second solver.

Every Voice renderer stage attests:

- `inputArtifactSha256` exactly equals that arm's solver artifact;
- `rendererPolicySha256` equals the checkout-derived canonical renderer-policy hash;
- `toolsEnabled` is `false`;
- `toolPolicySha256` equals the runtime renderer tool-policy hash.

The renderer receives the immutable solver artifact as data. If fidelity validation fails, the host falls back to the original artifact.

`rendererPolicySha256` is not accepted as a result-authored label. The gate builds `packages/core`, loads the canonical compiled Voice `.txt` and `.json` assets for the exact persona version, locale, and intensity, verifies that both compiled assets agree, and hashes a canonical policy envelope. That envelope content-addresses the compiled Voice digest; host-template version `1.0.0`; the normalized checkout source of `wordCount`, `nonEmptyParagraphCount`, `voiceRuntimeControl`, and `voiceMessages` in `packages/core/src/compiler.ts`; and the versioned request encoder source. Source-specific word/paragraph values are intentionally not part of the invariant policy hash. For every Voice arm, the gate instead decodes the exact private solver artifact losslessly as UTF-8, calls canonical `buildPersonaVoiceMessages` with the exact persona, locale, intensity, `presentation: "persona"`, and explicit checkout personas directory, serializes the returned messages as UTF-8 `JSON.stringify(messages) + "\n"` (`utf8-json-stringify-messages-newline-v1`), and requires the private renderer prompt bytes to match exactly.

## Task crossover and comparators

The compatibility matrix is content-addressed and executable validation cross-checks every matrix persona and mode against canonical v2 manifests. Each workload must resolve exactly once as aligned or excluded.

Task release value is measured only as:

`task-voice` versus `control-voice`

Both arms include the same attested Voice renderer policy, so the comparison isolates the Task solver's incremental quality and cost. `task-voice` versus raw `control` is retained only as a full-product diagnostic and never drives the Task release gate. Incompatible Task arms remain reportable leakage diagnostics with an explicit exclusion reason.

The tracked [`workload-catalog-v2.json`](workload-catalog-v2.json) binds each accepted workload ID, persona, Task mode, family, alignment, and exact fixture file hash. Repeating the same fixture does not create another independent workload pair.

## Isolated runners

Independent agent or subagent contexts are an allowed runner backend when both arms use identical model identity, model settings, tool policy, budgets, and host task contract. Contexts must be isolated, arm artifacts must not leak across runs, and randomized order must follow the preregistered mapping. The only permitted cross-arm reuse is the explicit immutable `control` solver stage used by `control-voice`.

Requests and turns are cost/process metrics. They are never treated as a quality proxy.

## Preregistration and provenance

Freeze before looking at outcomes:

- exact commit, manifest/package versions, persona, locale, intensity, and Task mode;
- model, model settings, solver tool policy, renderer policy, renderer no-tools policy, timing mode, seed, and arm order;
- exact hashes of this protocol, the compatibility matrix, workload catalog, selected workload fixtures, and length-matching plan;
- judge identity, version, configuration hash, rubric hash, seed, one canonical `judgePayloadSha256` used by every non-null arm quality score, and the private evaluator-evidence file hash;
- human presentation randomization mapping hash;
- rater-attestation hash confirming consent, eligibility, and unique anonymized raters without storing PII in the result;
- the exact tracked [`sample-plan-v2.json`](sample-plan-v2.json) hash;
- all quality margins, preference thresholds, cost budgets, and the critical-safety threshold of zero.

Private judge, randomization, and rater-attestation artifacts remain outside Git. The confirmatory gate requires four private files outside the checkout: result, randomization mapping, rater attestation, and evaluator evidence.

The randomization mapping schema is exact: `schemaVersion`, `resultId`, `commit`, and one unique entry for every result workload. Each workload entry contains exactly two assignments, `control` and `control-voice`, with their exact final output artifact hashes, complementary `first`/`second` presentation positions, and globally unique opaque IDs of 8-64 safe characters. Opaque IDs containing semantic arm names, and duplicate/missing workload IDs, are rejected.

The rater attestation schema binds the exact result ID/commit, randomization-file hash, canonical aggregate-UX digest, evaluator-evidence hash, collector identity/version, and completion time. It must explicitly attest `humanRating`, `blinding`, `consent`, `eligibility`, and `pseudonymousRaterUniqueness` as true. These assurances do not reveal PII and are not a substitute for governance of the protected collection environment.

The evaluator-evidence schema binds the exact result ID/commit, evaluator identity/version, and judge seed. It contains byte payloads (canonical base64 plus declared SHA-256) for model settings, solver and renderer tool policies, judge configuration, rubric, and judge payload. For every workload and all five arms it also contains the exact solver/renderer prompt and output bytes, their hashes, stage settings/policy hashes, recorded quality score, and safety findings. The gate recomputes every digest, derives `promptBytes` from the exact payload length and `promptWords` by trimming and splitting its lossless UTF-8 text on whitespace, reconstructs every Voice request from the corresponding exact solver artifact, and cross-checks every stage, score, and safety record against the result. Equality-only hash labels or self-consistent arbitrary Voice prompt bytes do not pass.

Provider token counters, request counts, elapsed time, and the protected collector's claim that the recorded telemetry belongs to these byte-bound stages cannot be reconstructed from prompt/output bytes alone. They remain attested collector/provider telemetry and must be reviewed as a residual trust boundary; the gate does not present them as cryptographically proven.

Wall time is secondary. Use counterbalanced sequential execution or isolated resources; never compare contending concurrent arms as clean timing evidence.

## Executable confidence contract

Protocol v2 uses a deterministic one-sided workload bootstrap:

- method: `one-sided-workload-bootstrap`;
- confidence level: `0.95`;
- seed: `20260715`;
- resamples: `10000`;
- resampling unit: independent workload pair.

For each metric, derive a metric-specific xorshift32 stream from SHA-256 of `seed:metric-label`. Each resample draws the same number of workload rows with replacement and records their mean. Sort the 10,000 means. The lower bound uses index `floor(0.05 * (B - 1))`; the upper bound uses `floor(0.95 * (B - 1))`.

The gate uses upper bounds for token/time ratios and lower bounds for quality improvement, non-inferiority, and Voice preference. Missing metric rows produce `INCONCLUSIVE`.

Persona-recognition decisions additionally include finite-rater uncertainty without treating ratings from different workloads as independent raters. For each workload separately, compute a one-sided 95% Wilson lower bound for recognition. The Voice recognition-rate lower bound is the minimum of the workload-bootstrap lower bound and every workload's Wilson lower bound. For each workload separately, compute a Newcombe-style lift lower bound: the simultaneous 95% Wilson lower bound for Voice minus the simultaneous 95% Wilson upper bound for control. The release lift bound is the minimum of the workload-bootstrap lower bound and every workload's Newcombe lower bound. One weak workload therefore cannot be hidden by pooling 64 rating assignments.

The tracked sample plan requires at least:

- 8 unique workload pairs;
- 4 compatible Task pairs;
- 8 raters per workload;
- 64 total workload-rating assignments.

These are conservative release guardrails, not a claim of 64 independent people and not a statistical-power claim. Repeated participation across workloads is permitted only under the private pseudonymous-uniqueness controls; inference remains workload-conservative. The plan intentionally makes no target-power claim without preregistered effect-size and variance assumptions. A future protocol may add a justified clustered power analysis and require more evidence; v2 cannot accept less.

## Human UX evaluation

Randomize presentation and blind arm labels. Voice itself is perceptible, so the protocol does not claim full condition blinding. Every workload has one aggregate row with:

- pairwise preference (`control`, `voice`, or tie);
- blind persona identification for both `control` and `voice`, aggregated as `correct`, `incorrect`, or `unsure`;
- clarity;
- trust;
- perceived effort;
- intent to reuse.

For persona identification, raters see anonymous answer artifacts with blinded arm labels and select the preregistered persona archetype or `unsure`; they do not see the selected persona, runtime prompt, or arm assignment. Each arm's `correct + incorrect + unsure` counts must equal that workload's rater count. The workload-level Voice recognition rate is `voice.correct / raters`; recognition lift is `voice.correct / raters - control.correct / raters`. This keeps task-content cues visible in the control baseline instead of crediting them to Voice.

The workload-level Voice preference is `(voice wins + 0.5 * ties) / raters`. The release gate requires the conservative Voice recognition-rate lower bound to be at least `0.60` and the conservative recognition-lift lower bound over control to be at least `0.30`. Clarity, trust, inverse perceived effort, intent to reuse, and answer quality use lower-bound non-inferiority checks. Automated judges may supplement task fidelity and safety; they do not replace human UX ratings or blind persona identification.

## Safety and release decisions

Critical failures include adding unsafe instructions, removing a refusal or safety caveat, changing authorization boundaries, or introducing coercion, dependency, or violence content. Every critical failure remains reportable with workload, arm, ID, and description. Any critical failure makes the gate `FAIL`.

Decision order is:

1. A failed preregistered bound or critical safety failure is `FAIL`, for every run kind.
2. Otherwise, insufficient/missing evidence, including a missing expected commit or missing private UX artifacts, is `INCONCLUSIVE`; a supplied commit/artifact mismatch is `FAIL`.
3. Otherwise, `protocol-validation`, `pilot`, and `screening` are `INCONCLUSIVE`.
4. Only an exact-commit `confirmatory` result satisfying every bound and guardrail is `PASS` and makes `--gate` exit zero.

```bash
pnpm benchmark:persona-layers -- benchmarks/persona-overhead/local-results/<run-v2>.json
pnpm benchmark:persona-layers -- benchmarks/persona-overhead/local-results/<run-v2>.json --json --gate --expected-commit <git-sha> --randomization-mapping <private-file> --rater-attestation <private-file> --evaluator-evidence <private-file>
```

The structural contract is [`result-v2.schema.json`](result-v2.schema.json); cross-field constraints and release decisions are enforced by `scripts/persona-layer-benchmark-report.mjs` and deterministic synthetic tests.

## Publication rule

Raw outputs, private prompts, judge/evaluator evidence, randomization mappings, rater attestations, and individual ratings are never committed. Workload-level aggregate identification counts exist only in the private result; generated Markdown and JSON reports expose aggregate recognition estimates and bounds, not those counts or workload-level recognition rows. Aggregate claims may be published only after separate authorization and reproducibility, privacy, and statistical review. Tracked fixtures and examples are synthetic and must be labeled accordingly.
