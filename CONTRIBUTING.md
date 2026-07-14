# Contributing

Thank you for helping make AI Agent Personas more useful, distinctive, and safe. Small, focused pull requests are easier to review than mixed code-and-content changes.

## Before you start

- Search existing issues and pull requests.
- Use the persona proposal template for a new archetype or a substantial voice change.
- Discuss manifest schema or public API changes before implementing them.
- Never include API keys, private conversations, or personal data in examples or tests.

By contributing, you agree that source-code contributions are licensed under MIT and content, documentation prose, and original visual contributions are licensed under CC BY 4.0.

## Development

Requirements: Node.js 24+ and pnpm 11+.

```bash
pnpm install
pnpm validate
pnpm check
pnpm dev
```

Useful focused commands:

```bash
pnpm --filter @ai-agent-personas/core test
pnpm --filter ai-agent-personas test
pnpm --filter @ai-agent-personas/web build
```

Model-backed evaluations are optional during normal development because they require credentials and incur cost:

```bash
pnpm eval:validate
cp .env.example .env
# Add OPENAI_API_KEY to .env, then run:
pnpm eval
```

The validation command is offline and safe to run without provider credentials.

On PowerShell, use `Copy-Item .env.example .env` for the first command.

## Persona changes

Follow `docs/persona-authoring.md` and `docs/safety.md`. A persona pull request should include:

- complete English and Russian copy;
- examples covering at least six task shapes per language;
- distinct subtle, balanced, and immersive modifiers;
- persona-specific avoid and safety rules;
- updated tests or eval cases when behavior changes;
- a short explanation of the practical user need the persona solves.

Do not imitate a named copyrighted character, public figure, creator, or living person's recognizable voice.

## Code changes

- Keep the core package provider-neutral and deterministic.
- Keep CLI behavior scriptable: stdout for results, stderr for warnings/errors, non-zero exit codes on failure.
- Keep the website statically buildable and accessible without client-side JavaScript for primary content.
- Avoid adding dependencies when a small, maintained internal solution is sufficient.
- Add or update tests for behavior changes.

## Pull requests

1. Create a focused branch from `main`.
2. Make the smallest coherent change.
3. Run `pnpm check` and record any intentionally skipped checks.
4. Complete the pull-request template.
5. Respond to review with new commits; avoid force-pushing after review starts unless necessary.

Maintainers may edit titles, labels, and descriptions for discoverability. Content that cannot meet the safety contract may be declined even when technically valid.
