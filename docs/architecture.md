# Architecture

AI Agent Personas is a data-first monorepo. Persona manifests are the product; the core package, CLI, website, and evaluations are consumers of the same canonical data.

## Dependency direction

```text
personas/*.json
      │
      ▼
packages/core ────────► packages/cli
      │                     │
      ├────────────────────►│ user terminal / clipboard / files
      │
      ├────────────────────► apps/web ──► static GitHub Pages output
      │
      └────────────────────► evals ─────► optional model providers
```

No consumer owns a second persona representation. The website and CLI must use the core API rather than reimplementing prompt assembly.

## Workspace boundaries

### `personas/`

Canonical, versioned JSON manifests. Content uses CC BY 4.0. A manifest contains bilingual display copy, behavior rules, safety constraints, example conversations, and one modifier per intensity level.

### `packages/core`

An internal, private workspace package and the source of truth for:

- TypeScript types and the JSON schema.
- Runtime validation and catalog discovery.
- `listPersonas()` and `getPersona()`.
- Deterministic `compilePersona()` output.

The compiler performs no model call and has no provider dependency. Given the same manifest, locale, and intensity, it returns the same string.

### `packages/cli`

The sole public npm package, published as `ai-agent-personas`. It embeds and re-exports the core API and data, then adds argument parsing, terminal formatting, clipboard integration, file export, exit codes, and human-readable errors. It must not mutate persona manifests or require consumers to install the private workspace scope.

### `apps/web`

An Astro static site. All persona routes are generated at build time. Browser-side JavaScript is limited to filters, tabs, locale/intensity controls, copy, download, and accessible status feedback. There is no backend, database, authentication layer, or runtime model call.

### `evals/`

An optional Promptfoo harness for end-to-end behavior checks against a configured LLM. It consumes compiled prompts from the built core package. API-backed evals are deliberately separated from deterministic CI because they cost money and may vary over time.

## Public contracts

### Manifest version

`schemaVersion` changes only when the manifest shape changes. Additive optional fields may use a minor version; incompatible changes require a major version and a migration guide.

### Persona version

Each persona has its own `version`. Patch changes fix wording without changing intent. Minor changes add examples or compatible behavior. Major changes alter the persona's promised voice or safety behavior.

### Core API

The core API follows semantic versioning as part of the public `ai-agent-personas` package. The internal `@ai-agent-personas/core` workspace package is never published separately. Its manifest files, compiled variants, catalog, schema, and TypeScript declarations are embedded in the public artifact so consumers can inspect source data and attribution.

### CLI

Commands, flags, output formats, exit codes, and stdout/stderr separation are public interfaces. Human display text may evolve; JSON output must remain machine-compatible within a major version.

## Design choices

- **JSON over Markdown front matter:** strict validation and predictable downstream consumption are more valuable than free-form editing.
- **Bilingual fields together:** reviewers can compare semantic parity in one diff.
- **Intensity as a modifier:** the canonical role remains stable while expressive language changes.
- **Static web output:** GitHub Pages stays cheap, reliable, private-repo compatible where the account plan allows it, and easy to mirror.
- **No provider SDK in core:** the library remains usable with any current or future LLM stack.

## Failure model

- Invalid manifests fail validation and builds.
- Unknown persona IDs, locales, intensities, or output formats fail with actionable errors and non-zero CLI exit codes.
- Clipboard failure is reported; it must not silently claim success.
- Website copy/download controls provide visible status and retain a manual-selection fallback.
- API-backed eval failure does not block deterministic local development unless the release checklist explicitly requires it.
