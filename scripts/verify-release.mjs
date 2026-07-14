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
  const changelog = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
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
    cli.exports?.['./catalog.json'] === './dist/core/catalog.json',
    'The compiled catalog export is missing or incorrect.',
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
