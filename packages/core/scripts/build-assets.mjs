import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceDirectory = resolve(packageDirectory, "../..");
const sourceDirectory = resolve(workspaceDirectory, "personas");
const targetDirectory = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(packageDirectory, "dist");
const bundledDirectory = resolve(targetDirectory, "personas");
const compiledDirectory = resolve(targetDirectory, "compiled");
const compiledV2Directory = resolve(targetDirectory, "compiled-v2");

const core = await import(pathToFileURL(resolve(targetDirectory, "index.js")).href);
await mkdir(bundledDirectory, { recursive: true });

for (const id of core.BUILT_IN_PERSONA_IDS) {
  const sourceFile = resolve(sourceDirectory, id, "persona.json");
  const targetFile = resolve(bundledDirectory, id, "persona.json");
  JSON.parse(await readFile(sourceFile, "utf8"));
  await mkdir(dirname(targetFile), { recursive: true });
  await cp(sourceFile, targetFile);
}

const variants = core.buildPersonaMatrix({ personasDirectory: bundledDirectory });
for (const variant of variants) {
  const targetDirectory = resolve(
    compiledDirectory,
    variant.id,
    variant.locale,
  );
  await mkdir(targetDirectory, { recursive: true });
  const base = resolve(targetDirectory, variant.intensity);
  await writeFile(`${base}.txt`, variant.text, "utf8");
  await writeFile(`${base}.md`, variant.markdown, "utf8");
  await writeFile(`${base}.json`, `${JSON.stringify(variant.json, null, 2)}\n`, "utf8");
}

const summaries = core.listPersonas({ personasDirectory: bundledDirectory });
const catalog = {
  schemaVersion: "1.0.0",
  personas: summaries,
  variants: variants.map(({ id, locale, intensity }) => ({
    id,
    locale,
    intensity,
    files: {
      text: `compiled/${id}/${locale}/${intensity}.txt`,
      markdown: `compiled/${id}/${locale}/${intensity}.md`,
      json: `compiled/${id}/${locale}/${intensity}.json`,
    },
  })),
};
await writeFile(
  resolve(targetDirectory, "catalog.json"),
  `${JSON.stringify(catalog, null, 2)}\n`,
  "utf8",
);

function layerFileSet(relativeBase) {
  return {
    text: `${relativeBase}.txt`,
    markdown: `${relativeBase}.md`,
    json: `${relativeBase}.json`,
  };
}

async function writeLayerFiles(relativeBase, compile) {
  const absoluteBase = resolve(targetDirectory, relativeBase);
  await mkdir(dirname(absoluteBase), { recursive: true });
  await writeFile(`${absoluteBase}.txt`, compile("text"), "utf8");
  await writeFile(`${absoluteBase}.md`, compile("markdown"), "utf8");
  await writeFile(`${absoluteBase}.json`, compile("json"), "utf8");
  return layerFileSet(relativeBase.replaceAll("\\", "/"));
}

await mkdir(compiledV2Directory, { recursive: true });
const layerMatrix = core.buildPersonaLayerMatrix({ personasDirectory: bundledDirectory });
const layerEntries = [];

for (const entry of layerMatrix) {
  const relativeRoot = `compiled-v2/${entry.id}/${entry.locale}`;
  const safety = await writeLayerFiles(`${relativeRoot}/safety`, (format) =>
    core.compilePersonaSafety(entry.id, {
      personasDirectory: bundledDirectory,
      locale: entry.locale,
      format,
    }),
  );

  const voice = {};
  for (const intensity of core.PERSONA_INTENSITIES) {
    voice[intensity] = await writeLayerFiles(
      `${relativeRoot}/voice/${intensity}`,
      (format) =>
        core.compilePersonaVoice(entry.id, {
          personasDirectory: bundledDirectory,
          locale: entry.locale,
          intensity,
          format,
        }),
    );
  }

  const taskModes = [];
  for (const mode of entry.taskModes) {
    taskModes.push({
      id: mode.taskModeId,
      files: await writeLayerFiles(
        `${relativeRoot}/task/${mode.taskModeId}`,
        (format) =>
          core.compilePersonaTaskMode(entry.id, {
            personasDirectory: bundledDirectory,
            locale: entry.locale,
            taskModeId: mode.taskModeId,
            format,
          }),
      ),
    });
  }

  layerEntries.push({
    id: entry.id,
    personaVersion: entry.version,
    locale: entry.locale,
    files: { safety, voice, taskModes },
  });
}

const layerPersonas = core.BUILT_IN_PERSONA_IDS.map((id) =>
  core.getPersona(id, { personasDirectory: bundledDirectory }),
)
  .sort((left, right) => left.id.localeCompare(right.id, "en"))
  .map((manifest) => {
    if (manifest.schemaVersion !== "2.0.0") {
      throw new Error(`Layer assets require v2 persona ${manifest.id}.`);
    }
    return {
      id: manifest.id,
      version: manifest.version,
      category: manifest.category,
      tags: [...manifest.tags],
      color: manifest.color,
      name: manifest.display.name,
      summary: manifest.display.summary,
      safetyRating: manifest.safety.rating,
      taskModes: manifest.taskModes.map((mode) => ({
        id: mode.id,
        name: mode.name,
        summary: mode.summary,
      })),
    };
  });

const layerCatalog = {
  schemaVersion: "2.0.0",
  manifestSchemaVersion: "2.0.0",
  personas: layerPersonas,
  entries: layerEntries,
};
await writeFile(
  resolve(targetDirectory, "layer-catalog.json"),
  `${JSON.stringify(layerCatalog, null, 2)}\n`,
  "utf8",
);
