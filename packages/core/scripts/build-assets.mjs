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
