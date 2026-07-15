# Changelog

All notable changes to this project will be documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases use [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-07-15

### Added

- Schema-v2 manifests with independent Safety, explicit Task modes, and output-only Voice.
- Layer-specific core APIs, provider-neutral Voice message assembly, and new compiled layer catalog.
- Voice-first CLI with explicit Task, Safety, and deprecated Legacy surfaces, plus a static website workbench with explicit Voice, Task, and Safety controls.
- Five-arm solver/renderer benchmark protocol with human UX dimensions, tracked sample guardrails, and a confirmatory-only release gate with zero critical safety failures.

### Changed

- All seven bilingual personas were editorially separated so intensity affects presentation only.
- Model evaluations now test Voice, Task, and Safety independently.

### Deprecated

- The global `compilePersona()`/`compilePersonaManifest()` path and legacy compiled catalog remain for one migration cycle.

## [0.1.0] - 2026-07-15

### Added

- Initial bilingual catalog with seven safety-aware personas.
- Three intensity levels for every persona.
- Typed core package, npm CLI, and static Astro website.
- Validation, automated tests, Promptfoo evaluation harness, and GitHub workflows.
- English and Russian project documentation.
