# Repository adoption audit v1

> Legacy calibration only. This workload intentionally applies the complete v1 persona on every turn and therefore measures a mixed Voice + Task + Safety treatment. Do not use it as the primary estimate of output-only UX value. Use [`../protocol-v2.md`](../protocol-v2.md) for the layered design.

This is the canonical repository-audit workload. The exact launch template is
[`repository-audit-v1.task.txt`](repository-audit-v1.task.txt). Fill its declared placeholders, retain both
rendered payloads, and hash them before launch. The rendered control and persona payloads must be
byte-identical except for `{{TREATMENT_BLOCK}}`.

The exact label-blinded scoring template is
[`repository-audit-v1.judge.txt`](repository-audit-v1.judge.txt). Randomize the A/B mapping before
rendering it, retain the rendered evaluator payload and mapping as separate artifacts, and record their
hashes with the evaluator output hash.

## Fixed setup

- Workspace: `<absolute-workspace-path>`
- Expected commit: `<40-character-commit-sha>`
- Read-only: never edit or create files, change Git state, or mutate external state.
- Retained orchestration metadata: exact model-configuration artifact, exact tool-policy artifact, their
  SHA-256 values, timing mode, and actual launch order.
- Goal objective, with no token budget: `Complete the fixed 28-round read-only repository adoption audit,
  preserve one evidence record per round, and produce a final evidence-ranked synthesis without modifying
  repository or external state.`
- Scheduled steps: 30 (setup, 28 rounds, final synthesis).

Step 1 creates the goal, records hashes for every effective repository instruction file, verifies the
commit and worktree state, and reports only `SETUP` with status, commit, and instruction hashes. It must
not execute round 1. A dirty or unrecorded instruction surface invalidates a clean run.

Build the effective-instruction manifest by sorting the surface names, writing one
`<sha256><two spaces><surface-name>` entry per line with LF endings, and hashing that retained manifest.
Runtime-owned instructions that cannot be exported make the run internally comparable but not externally
reproducible; record that limitation rather than inventing a hash.

Each automatic goal continuation executes exactly one next round, in numerical order, using at most two
targeted read-only tool calls. Each round is at most 120 words and uses exactly:

```text
ROUND <n> | FINDING: ... | EVIDENCE: ... | CONFIDENCE: high|medium|low | OPEN: ...
```

After round 28, the next continuation uses the template's fixed 350-word synthesis shape, marks the goal
complete, reads the goal ledger, and reports its exact tokens and elapsed time plus `scheduled_steps=30`.
It also records actual model requests when the runtime exposes them and otherwise records that counter as
unavailable. It must not invent counters.

## Fixed rounds

1. Root `package.json` and `pnpm-workspace.yaml`: engines, scripts, reproducibility.
2. Core persona schema: rigor and evolution.
3. Compiler and tests: determinism and prompt overhead.
4. Loader, validator, and tests: integrity and error handling.
5. Seven manifests: required fields and completeness.
6. EN/RU parity: structure and encoding risk.
7. Persona safety and `docs/safety.md`: consistency.
8. CLI API and binary: surface and scriptability.
9. CLI tests: exits, stdout/stderr, and Windows behavior.
10. CLI package and pack controls.
11. Website static-route architecture.
12. Prompt controls and progressive enhancement.
13. Accessibility evidence and gaps.
14. SEO, sitemap, robots, and homepage.
15. Eval configuration and tests: coverage and provider assumptions.
16. Eval attestation integrity and replay resistance.
17. CI workflow gates, permissions, and action pinning.
18. Pages workflow safety, triggers, and rollback.
19. npm release workflow, provenance, and bootstrap requirements.
20. v0.1.0 version and changelog coherence.
21. `README.md`/`README.ru.md` parity and onboarding.
22. Architecture, authoring, and evaluation documentation.
23. Contributing and Code of Conduct readiness.
24. `SECURITY.md` and repository-encoded security posture.
25. Licenses, `NOTICE`, and content licensing.
26. Roadmap priorities, measurability, and adoption.
27. Test portfolio balance and gaps.
28. Cross-check all claims against Git status and commit; list contradictions or unsupported claims.

## Treatment block

For control, replace `{{TREATMENT_BLOCK}}` with the empty string. For treatment, replace it with this exact
wrapper, including the final blank line:

```text
PERSONA START
{{COMPILED_PERSONA_PROMPT}}
PERSONA END
Apply the persona instructions above on every turn.

```

Replace `{{COMPILED_PERSONA_PROMPT}}` with the complete canonical compiler output. The fixed wrapper and
compiled prompt together are the treatment; no other character, schedule, goal, output, or tool-policy
difference is permitted. Retain and hash the compiled prompt and both final payloads.
