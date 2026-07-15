import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

const [config, copy, personaData, home, detail, workbench, rail, catalog, layout, styles, sitemap, robots, schemaV1Route, schemaV2Route] = await Promise.all([
  source("astro.config.mjs"),
  source("src/lib/site.ts"),
  source("src/lib/persona-data.ts"),
  source("src/components/HomePage.astro"),
  source("src/components/DetailPage.astro"),
  source("src/components/PromptWorkbench.astro"),
  source("src/components/PersonaRail.astro"),
  source("src/components/CatalogPage.astro"),
  source("src/layouts/BaseLayout.astro"),
  source("src/styles/global.css"),
  source("public/sitemap.xml"),
  source("public/robots.txt"),
  source("src/pages/schema/persona-v1.json.ts"),
  source("src/pages/schema/persona-v2.json.ts"),
]);

assert.match(config, /base:\s*["']\/ai-agent-personas["']/);
assert.match(config, /output:\s*["']static["']/);
assert.match(copy, /Give your agent a voice worth remembering\./);
assert.match(copy, /Voice adds character after the answer is solved — never inside solver reasoning\./);
assert.match(copy, /Voice adds no persona-driven reasoning tokens to the solver stage\./);
assert.match(copy, /Voice не добавляет persona-driven reasoning-токены на этапе решения\./);
assert.match(copy, /Voice renders a finished answer; Task methods activate only after an explicit compatibility check\./);
assert.match(copy, /Voice оформляет готовый ответ, а Task-метод включается только после явной проверки совместимости\./);
assert.doesNotMatch(`${copy}\n${layout}`, /ready for any LLM|подходит для любой LLM/iu);
assert.match(home, /npx ai-agent-personas list/);
assert.match(home, /compileLayerMap/);
assert.match(home, /Persona stays out of reasoning/);
assert.match(home, /Персона не участвует в reasoning/);
assert.match(home, /reasoning-boundary/);
assert.match(home, /t\.home\.reasoningSteps/);
assert.match(detail, /data-tabset/);
assert.match(detail, /PromptWorkbench/);
assert.doesNotMatch(detail, /PersonaControls/);
assert.match(detail, /--locale/);
assert.match(detail, /commandTargetId=\{cliCommandId\}/);
assert.match(detail, /--intensity balanced/);
assert.doesNotMatch(detail, /instance="hero"/);
assert.match(personaData, /compilePersonaLayers/);
assert.match(personaData, /listPersonaTaskModes/);
assert.match(personaData, /taskModeId: mode\.id/);
assert.match(workbench, /replaceAll\("<", "\\\\u003c"\)/);
assert.match(workbench, /Reflect\.get\(document, "execCommand"\)/);
assert.match(workbench, /range\.selectNodeContents\(output\)/);
assert.match(workbench, /function isLayerMap/);
assert.match(workbench, /data-layer="voice"|data-layer=\{layer\}/);
assert.match(workbench, /data-task-mode-field hidden/);
assert.match(workbench, /taskModeField\.hidden = activeLayer !== "task"/);
assert.match(workbench, /intensityField\.hidden = activeLayer !== "voice"/);
assert.match(workbench, /promptContainer\.hidden = !hasPrompt/);
assert.match(workbench, /taskEmpty\.hidden = hasPrompt/);
assert.match(workbench, /anchor\.download = `\$\{workbench\.dataset\.personaId\}\.\$\{locale\.value\}\.\$\{suffix\}\.txt`/);
assert.doesNotMatch(workbench, /compilePersona/);
assert.match(workbench, /data-update-success/);
assert.match(workbench, /data-prompt-unavailable/);
assert.match(workbench, /selectedOptions/);
assert.match(workbench, /data-command-target=\{commandTargetId\}/);
assert.match(workbench, /--mode \$\{taskMode\?\.value \|\| "<task-mode-id>"\}/);
assert.match(workbench, /command\.textContent = currentCommand\(\)/);
assert.match(rail, /<ul class="persona-rail"/);
assert.match(rail, /<li[\s\S]*?data-persona-item[\s\S]*?>\s*<a/);
assert.doesNotMatch(rail, /role="listitem"/);
assert.match(catalog, /intensity-card__default/);
assert.match(copy, /BUILT_IN_PERSONA_IDS/);
assert.match(copy, /PERSONA_LOCALES/);
assert.match(copy, /PERSONA_INTENSITIES/);
assert.doesNotMatch(copy, /personaMeta/);
assert.doesNotMatch(copy, /\bsample\s*:/);
assert.match(layout, /rel="canonical"/);
assert.match(layout, /property="og:title"/);
assert.match(layout, /name="twitter:card"/);
assert.doesNotMatch(styles, /linear-gradient|radial-gradient|box-shadow:\s*[^n]/i);
assert.match(styles, /\.persona-rail__entry\[hidden\]/);
assert.match(styles, /@media \(max-width: 1120px\)[\s\S]*?\.persona-rail__entry/);
assert.equal((sitemap.match(/<url>/g) ?? []).length, 18);
assert.match(robots, /Sitemap: https:\/\/wsnhdev\.github\.io\/ai-agent-personas\/sitemap\.xml/);
assert.match(schemaV1Route, /getPersonaSchemaV1/);
assert.match(schemaV1Route, /application\/schema\+json/);
assert.match(schemaV2Route, /getPersonaSchemaV2/);
assert.match(schemaV2Route, /application\/schema\+json/);

const distRoot = path.join(root, "dist");
const [wizardDetail, englishHome, russianHome] = await Promise.all([
  source("dist/personas/wizard/index.html"),
  source("dist/index.html"),
  source("dist/ru/index.html"),
]);
assert.match(wizardDetail, /fallback target/);
assert.match(englishHome, /persona-driven reasoning tokens to the solver stage/);
assert.match(russianHome, /persona-driven reasoning-токены на этапе решения/);
const distFiles = new Set(
  (await readdir(distRoot, { recursive: true })).map((file) => file.replaceAll(path.sep, "/")),
);
const basePath = "/ai-agent-personas/";

function outputFileFor(pathname) {
  assert.ok(
    pathname === basePath.slice(0, -1) || pathname.startsWith(basePath),
    `Internal URL escapes the configured base path: ${pathname}`,
  );
  const relative = pathname === basePath.slice(0, -1) ? "" : pathname.slice(basePath.length);
  if (!relative) return "index.html";
  return relative.endsWith("/") ? `${relative}index.html` : relative;
}

for (const htmlFile of [...distFiles].filter((file) => file.endsWith(".html"))) {
  const html = await source(path.join("dist", htmlFile));
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/gu)) {
    const url = match[1];
    if (!url?.startsWith("/")) continue;
    const pathname = url.split(/[?#]/u)[0];
    const target = outputFileFor(pathname);
    assert.ok(distFiles.has(target), `${htmlFile} links to missing ${target}`);
  }
}

for (const match of sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)) {
  const target = outputFileFor(new URL(match[1]).pathname);
  assert.ok(distFiles.has(target), `Sitemap links to missing ${target}`);
}

console.log(
  "Web smoke checks passed: static base, copy lock, interaction contracts, internal links, visual constraints, SEO assets.",
);
