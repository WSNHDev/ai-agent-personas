# Roadmap

## v0.1.0 — initial preview

- [x] Seven original personas in English and Russian.
- [x] Three intensity levels and an initial versioned manifest schema.
- [x] Typed core API and prompt compiler.
- [x] npm CLI with list, show, copy, export, and validate commands.
- [x] Static, accessible Astro catalog for GitHub Pages.
- [x] Unit, schema, build, and optional model-based eval checks.
- [x] Dual code/content licensing and contribution governance.
- [ ] Run the model-backed release eval on the exact release commit.
- [ ] Change the repository from private to public and enable community/security features.
- [ ] Deploy the public catalog through GitHub Pages.
- [ ] Publish `ai-agent-personas` to npm with provenance.
- [ ] Complete and record the final release checklist in `docs/release.md`.

## v0.2.0 — layered preview

- [x] Split persona content into output-only Voice, opt-in Task modes, and pre-action Safety.
- [x] Preserve an explicit v1/global migration surface without making it the default.
- [x] Add Voice-first CLI and static website workbench.
- [x] Add solver/renderer benchmark contracts with aligned and persona-neutral tasks.
- [ ] Run private confirmatory Voice fidelity, human UX, Task value, and Safety gates on an exact release commit with the tracked workload and rater sample guardrails.
- [ ] Publish measured claims only after separate reproducibility, privacy, and statistical review.

## v1.0.0 — stable layered foundation

- Incorporate layered-preview feedback and complete the announced one-cycle removal of v1 compatibility with migration notes.
- Publish compatibility fixtures for the supported Node.js and agent-runtime matrix.
- Establish reviewed public quality, UX, safety, cost, and adoption baselines.
- Document v2 stability guarantees and the completed v1 migration.

## v1.x — adoption

- Generate TypeScript manifest types from the canonical JSON Schema and fail CI on generated drift.
- Generate catalog membership, sitemap entries, and other derived indexes from validated manifests.
- Centralize repository URL, site origin, and Pages base-path configuration for forks and custom domains.
- Framework adapters for common agent SDKs, kept outside the canonical schema.
- Community persona submission pipeline with preview builds.
- Versioned compatibility fixtures for OpenAI, Anthropic, Google, and local models.
- Public eval dashboard with cost, style-adherence, safety, and task-quality trends.
- Search-engine metadata, social previews, and a public documentation domain.

## Later — composition

- Composable Voice, Task, Safety, and domain modules.
- User-authored persona overlays with deterministic conflict resolution.
- Signed catalog releases and machine-readable provenance.
- A stable adapter interface for agent runtimes and prompt registries.

The project will not optimize for persona count at the expense of quality. A smaller catalog with distinct, tested behavior is the primary product advantage.
