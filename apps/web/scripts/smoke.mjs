import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

const [config, copy, home, detail, controls, workbench, rail, catalog, layout, styles, sitemap, robots, schemaRoute] = await Promise.all([
  source("astro.config.mjs"),
  source("src/lib/site.ts"),
  source("src/components/HomePage.astro"),
  source("src/components/DetailPage.astro"),
  source("src/components/PersonaControls.astro"),
  source("src/components/PromptWorkbench.astro"),
  source("src/components/PersonaRail.astro"),
  source("src/components/CatalogPage.astro"),
  source("src/layouts/BaseLayout.astro"),
  source("src/styles/global.css"),
  source("public/sitemap.xml"),
  source("public/robots.txt"),
  source("src/pages/schema/persona-v1.json.ts"),
]);

assert.match(config, /base:\s*["']\/ai-agent-personas["']/);
assert.match(config, /output:\s*["']static["']/);
assert.match(copy, /Give your agent a voice worth remembering\./);
assert.match(copy, /Seven original, safety-aware personas\. Bilingual by design\. Ready for any LLM\./);
assert.match(home, /npx ai-agent-personas list/);
assert.match(detail, /data-tabset/);
assert.match(detail, /PromptWorkbench/);
assert.match(detail, /PersonaControls/);
assert.match(detail, /--locale/);
assert.doesNotMatch(detail, /instance="hero"/);
assert.match(controls, /persona:intensity/);
assert.match(workbench, /replaceAll\("<", "\\\\u003c"\)/);
assert.match(workbench, /Reflect\.get\(document, "execCommand"\)/);
assert.match(workbench, /range\.selectNodeContents\(output\)/);
assert.match(workbench, /const isPromptMap/);
assert.match(workbench, /data-update-success/);
assert.match(workbench, /data-prompt-unavailable/);
assert.match(workbench, /selectedOptions/);
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
assert.match(schemaRoute, /getPersonaSchema/);
assert.match(schemaRoute, /application\/schema\+json/);

const distRoot = path.join(root, "dist");
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
