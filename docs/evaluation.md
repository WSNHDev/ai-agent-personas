# Evaluation strategy

The project separates deterministic repository checks from model-backed behavioral evaluations.

## Deterministic checks

These run on every pull request and do not call an external model:

- JSON parsing and schema validation.
- Manifest ID/path consistency and canonical set membership.
- EN/RU completeness and all three intensity modifiers.
- Compilation of the full 7 × 2 × 3 matrix.
- Prompt length and output-format checks.
- CLI argument, exit-code, clipboard-fallback, and atomic-export behavior.
- Static website type checking, route generation, and production build.

A deterministic failure blocks merging.

## Model-backed release suite

`evals/promptfooconfig.yaml` runs sixteen bilingual scenarios through Promptfoo: one English and one Russian scenario for every persona, plus two cross-cutting instruction-override cases. The suite covers:

- useful task completion and requested formatting;
- correction of false or unsupported premises;
- factual language versus metaphor;
- evidence versus inference;
- switching to neutral style on request;
- nonsexual, nondependent playfulness;
- rejection of isolation, threats, concealment, insults, and aggression;
- persona-specific voice at different intensities.

The eval is manual because provider calls cost money and model outputs vary. It requires `OPENAI_API_KEY` and is also available through the protected `model-evaluations` GitHub environment.

```bash
pnpm eval:validate
cp .env.example .env
# Add OPENAI_API_KEY to .env, then run:
pnpm eval
```

`pnpm eval:validate` is offline: it validates the suite without contacting a model provider.

On PowerShell, use `Copy-Item .env.example .env` for the first command.

## GitHub attestation

The `Persona evaluations` workflow remains manual and protected by the
`model-evaluations` environment. Run it on the exact `main` commit intended for
release. A successful run uploads `persona-evaluation-<commit>` with the HTML
report, JSON results, and `eval-attestation.json`.

The attestation records the repository, commit, ref, provider, Promptfoo outcome,
workflow run ID and attempt, and SHA-256 digests for both
`evals/promptfooconfig.yaml` and `eval-results.json`. Failed runs may upload a
diagnostic attestation, but they never satisfy the npm release gate. Artifacts are
retained for 30 days; rerun the evaluation for the same commit if its artifact has
expired.

The npm workflow obtains the artifact through the GitHub Actions REST API. It
accepts only an unexpired artifact from a completed, successful,
`workflow_dispatch` run whose `head_sha` is the release commit. The local verifier
then recomputes both digests and checks the outcome, repository, commit, run ID,
and run attempt before any npm publication step can execute.

## Release interpretation

For a release candidate:

1. Every deterministic check must pass.
2. No persona may fail a safety-specific rubric.
3. Any quality regression must be reviewed against the previous release using the same model snapshot where possible.
4. A human reviewer must inspect all failures and a sample of passing outputs in both languages.
5. A model upgrade establishes a new baseline; scores from different model families are not compared as if they were identical instruments.

The suite measures the prompt-plus-model combination, not an intrinsic property of the manifest alone. A passing score never overrides an obvious unsafe or incorrect response.

## Adding cases

Prefer one scenario that isolates a foreseeable failure mode over many easy happy paths. Include the persona, locale, intensity, realistic user prompt, and an outcome-focused rubric. Do not prescribe exact prose unless exact formatting is the behavior under test.
