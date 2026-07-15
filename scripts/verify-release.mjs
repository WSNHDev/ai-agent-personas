import { readFile } from 'node:fs/promises';

const [tag] = process.argv.slice(2);

if (!tag) {
  console.error('Usage: node scripts/verify-release.mjs <git-tag>');
  process.exitCode = 2;
} else {
  const readPackage = async (path) => JSON.parse(await readFile(path, 'utf8'));
  const core = await readPackage(new URL('../packages/core/package.json', import.meta.url));
  const cli = await readPackage(new URL('../packages/cli/package.json', import.meta.url));
  const personaSchema = await readPackage(
    new URL('../packages/core/schema/persona.schema.json', import.meta.url),
  );
  const personaSchemaV2 = await readPackage(
    new URL('../packages/core/schema/persona-v2.schema.json', import.meta.url),
  );
  const changelog = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  const personaBenchmarkWorkflow = await readFile(
    new URL('../.github/workflows/persona-benchmark.yml', import.meta.url),
    'utf8',
  );
  const releaseWorkflow = await readFile(
    new URL('../.github/workflows/release.yml', import.meta.url),
    'utf8',
  );
  const expectedTag = `v${cli.version}`;
  const errors = [];
  const versionPattern = personaSchema?.properties?.version?.pattern;
  const semanticVersion = typeof versionPattern === 'string' ? new RegExp(versionPattern) : null;

  const requireCondition = (condition, message) => {
    if (!condition) errors.push(message);
  };

  requireCondition(
    tag.startsWith('v') && semanticVersion?.test(tag.slice(1)) === true,
    `Release tag ${tag} is not a valid v-prefixed semantic version.`,
  );
  requireCondition(tag === expectedTag, `Release tag ${tag} does not match ${expectedTag}.`);
  requireCondition(core.version === cli.version, `Package versions differ: core=${core.version}, cli=${cli.version}.`);
  requireCondition(core.name === '@ai-agent-personas/core', 'Unexpected internal core package name.');
  requireCondition(core.private === true, 'The internal core package must remain private.');
  requireCondition(
    personaSchemaV2?.properties?.schemaVersion?.const === '2.0.0',
    'The v2 persona schema must declare schemaVersion 2.0.0.',
  );
  requireCondition(
    core.exports?.['./schema/v1'] === './schema/persona.schema.json',
    'The internal v1 schema export is missing or incorrect.',
  );
  requireCondition(
    core.exports?.['./schema/v2'] === './schema/persona-v2.schema.json',
    'The internal v2 schema export is missing or incorrect.',
  );
  requireCondition(
    core.exports?.['./layer-catalog.json'] === './dist/layer-catalog.json',
    'The internal layer catalog export is missing or incorrect.',
  );
  requireCondition(cli.name === 'ai-agent-personas', 'Unexpected public package name.');
  requireCondition(cli.private !== true, 'The public package is marked private.');
  requireCondition(
    cli.license === 'SEE LICENSE IN LICENSES.md',
    'The public package must declare its mixed-license mapping.',
  );
  requireCondition(cli.publishConfig?.access === 'public', 'npm publish access must be public.');
  requireCondition(
    cli.bin?.['ai-agent-personas'] === './dist/bin.js',
    'The ai-agent-personas executable mapping is missing or incorrect.',
  );
  requireCondition(
    cli.exports?.['./schema'] === './dist/schema/persona.schema.json',
    'The persona schema export is missing or incorrect.',
  );
  requireCondition(
    cli.exports?.['./schema/v1'] === './dist/schema/persona.schema.json',
    'The v1 persona schema export is missing or incorrect.',
  );
  requireCondition(
    cli.exports?.['./schema/v2'] === './dist/schema/persona-v2.schema.json',
    'The v2 persona schema export is missing or incorrect.',
  );
  requireCondition(
    cli.exports?.['./catalog.json'] === './dist/core/catalog.json',
    'The compiled catalog export is missing or incorrect.',
  );
  requireCondition(
    cli.exports?.['./layer-catalog.json'] === './dist/core/layer-catalog.json',
    'The layer catalog export is missing or incorrect.',
  );
  requireCondition(
    personaBenchmarkWorkflow.includes('runs-on: [self-hosted, linux, persona-evals]') &&
      personaBenchmarkWorkflow.includes('environment: model-evaluations'),
    'The private persona benchmark must use the protected Linux persona-evals runner.',
  );
  requireCondition(
    personaBenchmarkWorkflow.includes('vars.PERSONA_BENCHMARK_RESULT_PATH') &&
      personaBenchmarkWorkflow.includes('--gate') &&
      personaBenchmarkWorkflow.includes('write-persona-benchmark-attestation.mjs'),
    'The private persona benchmark workflow must gate and attest its configured private result.',
  );
  const privateEvidenceStepStart = personaBenchmarkWorkflow.indexOf(
    '- name: Require private evidence outside the checkout',
  );
  requireCondition(
    privateEvidenceStepStart >= 0 &&
      personaBenchmarkWorkflow.indexOf('PERSONA_BENCHMARK_RESULT_PATH') >= privateEvidenceStepStart,
    'Private benchmark file paths must not be exposed to checkout, setup, install, or core build steps.',
  );
  const benchmarkUploadStep = personaBenchmarkWorkflow.slice(
    personaBenchmarkWorkflow.indexOf('- name: Upload only the benchmark attestation'),
  );
  requireCondition(
    benchmarkUploadStep.includes('path: ${{ runner.temp }}/persona-benchmark-attestation.json') &&
      !benchmarkUploadStep.includes('PERSONA_BENCHMARK_RESULT_PATH'),
    'The private persona benchmark workflow must upload only its attestation.',
  );
  requireCondition(
    releaseWorkflow.includes('actions/workflows/persona-benchmark.yml/runs') &&
      releaseWorkflow.includes('verify-persona-benchmark-attestation.mjs'),
    'The npm release workflow must require the same-commit private benchmark attestation.',
  );
  const releaseInstallStep = releaseWorkflow.indexOf('- name: Install dependencies');
  const releaseCoreBuildStep = releaseWorkflow.indexOf(
    '- name: Build the canonical core compiler assets',
  );
  const releaseBenchmarkVerificationStep = releaseWorkflow.indexOf(
    '- name: Verify private benchmark provenance and release gate',
  );
  requireCondition(
    releaseInstallStep >= 0 &&
      releaseCoreBuildStep > releaseInstallStep &&
      releaseBenchmarkVerificationStep > releaseCoreBuildStep,
    'The npm release workflow must install dependencies and build canonical core assets before verifying the benchmark attestation.',
  );

  const requiredFiles = [
    'dist',
    'README.md',
    'LICENSE',
    'LICENSE-CONTENT.md',
    'LICENSES.md',
    'NOTICE',
  ];
  for (const file of requiredFiles) {
    requireCondition(cli.files?.includes(file), `The npm package files list is missing ${file}.`);
  }

  for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [name, specifier] of Object.entries(cli[section] ?? {})) {
      requireCondition(
        name !== '@ai-agent-personas/core' && !String(specifier).startsWith('workspace:'),
        `Runtime dependency ${section}.${name} must not rely on the private workspace.`,
      );
    }
  }

  const escapedVersion = cli.version.replaceAll('.', '\\.').replaceAll('+', '\\+');
  requireCondition(
    new RegExp(`^## \\[${escapedVersion}\\](?: - \\d{4}-\\d{2}-\\d{2})?$`, 'm').test(changelog),
    `CHANGELOG.md has no release heading for ${cli.version}.`,
  );

  if (errors.length > 0) {
    console.error('Release verification failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`Release metadata and changelog are consistent for ${expectedTag}.`);
  }
}
