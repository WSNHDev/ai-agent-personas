# Release guide

Releases are deliberate because one release can change three public surfaces: the catalog, the website, and the npm package.

## Prerequisites

- Maintainer access to the GitHub repository.
- npm publish rights for `ai-agent-personas`.
- A public repository, required for npm provenance and for the full GitHub Free protection set used by this project.
- A protected `model-evaluations` environment with required reviewer approval and `OPENAI_API_KEY` access.
- A protected `npm` environment with required reviewer approval and either the `NPM_TOKEN` secret or npm trusted publishing configured.
- GitHub Pages set to **GitHub Actions** as its publishing source.
- A clean `main` branch with required status checks enabled.

## Release checklist

1. Confirm all persona and package versions are intentional.
2. Move relevant entries from `Unreleased` in `CHANGELOG.md` to the new version.
3. Run `pnpm install --frozen-lockfile` and `pnpm check` on a clean checkout.
4. Run `pnpm --filter ai-agent-personas test:pack`; it packs, installs, and exercises the exact public artifact in a temporary directory.
5. Inspect a separately packed tarball before publication.
6. Manually run the protected `Persona evaluations` workflow on the exact release commit, review regressions, and confirm its attested artifact completed successfully.
7. Verify the production-mode site at desktop and mobile viewport sizes.
8. Tag the exact commit as `vX.Y.Z` and create a GitHub release.
9. Approve the protected npm release environment if requested.
10. Verify npm provenance, package files, executable command, and installation from the public registry.
11. Verify GitHub Pages deployment and all EN/RU routes.

## Automated publication gate

Publishing a GitHub Release is the only trigger for npm publication. The release
job still requires approval from the `npm` environment and performs these checks
before `npm publish`:

1. Check out the release tag with full history and prove that its commit is an
   ancestor of `origin/main`.
2. Find a completed, successful manual evaluation run for that exact commit.
3. Download its unexpired `persona-evaluation-<commit>` artifact.
4. Verify that the attestation names the same repository, commit, workflow run ID
   and attempt, reports `success`, and matches the SHA-256 digests of the release
   commit's current Promptfoo config and the downloaded JSON results.
5. Run the deterministic checks, release metadata checks, and clean tarball smoke
   test before packing and publishing with npm provenance.

A draft release, a passing evaluation for another commit, a changed eval config,
an expired artifact, a failed Promptfoo outcome, or a tag outside `main` cannot
publish the package. If the candidate changes after evaluation, run the manual
suite again on the new commit before publishing its GitHub Release.

## First public release

For the first public release, additionally:

> A public read-only preview may expose the repository, website, and npm package before the community-participation gate opens. In that mode, Issues, Discussions, and external contributions remain closed until a monitored confidential conduct-reporting channel is published and tested. Placeholder text, a public issue, or Private Vulnerability Reporting alone does not satisfy this gate.

1. Confirm the README does not expose private planning notes or credentials.
2. Confirm every code and content file has a clear license path.
3. Review git history for secrets and unintended generated artifacts.
4. Reserve the npm package name before announcing the project.
5. Confirm a confidential conduct-reporting channel without exposing a private maintainer address unintentionally.
6. Change repository visibility to public so GitHub protections and npm provenance can be enforced.
7. Enable and test Private Vulnerability Reporting, Discussions, issue templates, rulesets, Dependabot, and the security policy.
8. Create and protect the `model-evaluations`, `npm`, and `github-pages` environments.
9. Run the model-backed evaluation on the exact release commit and review its attested artifact.
10. Deploy the site from `main` through GitHub Pages and verify all EN/RU routes.
11. Publish the npm package and verify provenance, package files, executable behavior, and a clean install.
12. Announce a single canonical website URL and repository URL.

Visibility changes and npm publication are external, difficult-to-reverse operations. The workflow prepares them but never performs either from an ordinary pull request. The Pages workflow deploys only reviewed `main` changes that affect the website or its canonical persona data.

## Rollback

- Never reuse or delete a published npm version. Deprecate a bad version and publish a corrected patch.
- Revert the website through a new commit; keep the previous Pages artifact for diagnosis.
- If a persona introduces harm, remove it from the catalog in a patch release and document the reason without reproducing unsafe content unnecessarily.
- Rotate any exposed token immediately and follow `SECURITY.md`.
