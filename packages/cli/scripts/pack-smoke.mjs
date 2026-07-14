import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceDirectory = resolve(packageDirectory, "../..");
const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "ai-agent-personas-pack-"));
const artifactDirectory = resolve(temporaryDirectory, "artifacts");
const consumerDirectory = resolve(temporaryDirectory, "consumer");

function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: options.cwd ?? workspaceDirectory,
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, NO_COLOR: "1" },
  });
  if (result.status !== 0) {
    throw new Error(
      `${commandName} ${args.join(" ")} failed\n${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  }
  return result.stdout;
}

function pnpm(args, cwd = workspaceDirectory) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath?.toLowerCase().includes("pnpm")) {
    return command(process.execPath, [npmExecPath, ...args], { cwd });
  }
  throw new Error("Run the pack smoke test through pnpm: pnpm test:pack");
}

try {
  await mkdir(artifactDirectory, { recursive: true });
  await mkdir(consumerDirectory, { recursive: true });
  command(process.execPath, [resolve(packageDirectory, "scripts/build.mjs")], {
    cwd: packageDirectory,
  });

  const packOutput = pnpm(
    ["pack", "--json", "--pack-destination", artifactDirectory],
    packageDirectory,
  );
  const packResult = JSON.parse(packOutput);
  const record = Array.isArray(packResult) ? packResult[0] : packResult;
  const filename = record?.filename ?? record?.path;
  if (typeof filename !== "string") {
    throw new Error(`Could not determine tarball path from pnpm pack --json:\n${packOutput}`);
  }
  const tarball = resolve(packageDirectory, filename);
  const alternativeTarball = resolve(artifactDirectory, filename.split(/[\\/]/u).at(-1));
  const resolvedTarball = existsSync(tarball) ? tarball : alternativeTarball;
  const packedPaths = Array.isArray(record?.files)
    ? record.files.map((file) => String(file.path).replaceAll("\\", "/"))
    : [];
  const expectedPackedPaths = [
    "dist/bin.js",
    "dist/core/catalog.json",
    "dist/core/personas/teacher/persona.json",
    "dist/schema/persona.schema.json",
    "README.md",
    "LICENSE",
    "LICENSE-CONTENT.md",
    "LICENSES.md",
    "NOTICE",
    "package.json",
  ];
  for (const path of expectedPackedPaths) {
    if (packedPaths.length > 0 && !packedPaths.includes(path)) {
      throw new Error(`pnpm pack --json did not include ${path}`);
    }
  }
  if (JSON.stringify(record).includes("@ai-agent-personas/core")) {
    throw new Error("Packed file manifest still references the private workspace core package.");
  }

  await writeFile(
    resolve(temporaryDirectory, "pack-result.json"),
    `${JSON.stringify(packResult, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    resolve(consumerDirectory, "package.json"),
    '{"name":"persona-pack-consumer","private":true,"type":"module"}\n',
    "utf8",
  );

  pnpm(
    [
      "add",
      "--ignore-scripts",
      resolvedTarball,
    ],
    consumerDirectory,
  );

  const installedPackage = resolve(consumerDirectory, "node_modules/ai-agent-personas");
  const requiredFiles = [
    "README.md",
    "LICENSE",
    "LICENSE-CONTENT.md",
    "LICENSES.md",
    "NOTICE",
    "dist/bin.js",
    "dist/core/personas/teacher/persona.json",
    "dist/core/compiled/teacher/en/balanced.json",
    "dist/core/catalog.json",
    "dist/schema/persona.schema.json",
  ];
  for (const file of requiredFiles) {
    if (!existsSync(resolve(installedPackage, file))) {
      throw new Error(`Packed artifact is missing ${file}`);
    }
  }

  const listOutput = pnpm(["exec", "ai-agent-personas", "list"], consumerDirectory);
  if (!listOutput.includes("teacher") || !listOutput.includes("yandere")) {
    throw new Error(`Installed CLI returned an incomplete catalog:\n${listOutput}`);
  }

  const importCheck = command(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      "import { listPersonas, compilePersona } from 'ai-agent-personas'; const list = listPersonas(); const prompt = compilePersona('teacher', { locale: 'en', intensity: 'balanced', format: 'text' }); if (list.length !== 7 || !prompt.includes('PERSONA: Teacher')) process.exit(1); console.log(list.length);",
    ],
    { cwd: consumerDirectory },
  );
  if (importCheck.trim() !== "7") {
    throw new Error(`Programmatic import check failed:\n${importCheck}`);
  }

  const packageJson = JSON.parse(
    await readFile(resolve(installedPackage, "package.json"), "utf8"),
  );
  const versionOutput = pnpm(
    ["exec", "ai-agent-personas", "--version"],
    consumerDirectory,
  );
  if (versionOutput.trim() !== packageJson.version) {
    throw new Error(
      `Installed CLI version ${versionOutput.trim()} does not match package ${packageJson.version}.`,
    );
  }
  for (const field of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
    "bundleDependencies",
    "bundledDependencies",
  ]) {
    if (JSON.stringify(packageJson[field] ?? {}).includes("@ai-agent-personas/core")) {
      throw new Error(`Published package.json has a runtime core reference in ${field}.`);
    }
  }
  if (
    packageJson.exports?.["./schema"] !== "./dist/schema/persona.schema.json" ||
    packageJson.exports?.["./catalog.json"] !== "./dist/core/catalog.json"
  ) {
    throw new Error("Published package is missing schema/catalog subpath exports.");
  }
  const schema = JSON.parse(
    await readFile(resolve(installedPackage, "dist/schema/persona.schema.json"), "utf8"),
  );
  const catalog = JSON.parse(
    await readFile(resolve(installedPackage, "dist/core/catalog.json"), "utf8"),
  );
  if (schema.$id !== "https://wsnhdev.github.io/ai-agent-personas/schema/persona-v1.json") {
    throw new Error("Packed JSON Schema is invalid or unexpected.");
  }
  if (catalog.schemaVersion !== "1.0.0" || catalog.variants?.length !== 42) {
    throw new Error("Packed catalog is invalid or incomplete.");
  }

  process.stdout.write(`Pack/install smoke test passed: ${resolvedTarball}\n`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
