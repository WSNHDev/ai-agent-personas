# Security policy

## Supported versions

Until `v1.0.0`, security fixes are applied to the default branch only. After the public release, the latest major version and the immediately preceding major version will receive security fixes when practical.

## Reporting a vulnerability

Do not open a public issue for a vulnerability, exposed credential, private data, or a reproducible prompt-injection path that could harm users.

Use [GitHub's private vulnerability reporting](https://github.com/WSNHDev/ai-agent-personas/security/advisories/new). Include:

- the affected commit, package, route, or persona;
- impact and realistic attack conditions;
- minimal reproduction steps;
- any known workaround;
- whether the report includes secrets or personal data.

You should receive an acknowledgement within five business days. We will share an initial assessment and next steps as soon as the impact is understood. Please allow a reasonable remediation window before public disclosure.

## Scope

In scope:

- dependency or build-chain vulnerabilities;
- unsafe file writes, command execution, or terminal escape behavior in the CLI;
- website vulnerabilities that affect visitors;
- accidental secret or private-data exposure;
- prompt content that reliably defeats the project's documented safety boundaries.

Ordinary model mistakes, style preferences, and requests for new personas belong in public issues after the repository launches.

## Safe harbor

Good-faith research that avoids privacy violations, data destruction, service disruption, social engineering, and unnecessary access will be treated as authorized for the purpose of coordinated disclosure.
