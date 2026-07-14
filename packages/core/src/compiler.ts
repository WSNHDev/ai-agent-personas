import { PersonaSourceError } from "./errors.js";
import { getPersona, listPersonas } from "./loader.js";
import { validatePersonaManifest } from "./validator.js";
import {
  BUILT_IN_PERSONA_IDS,
  PERSONA_INTENSITIES,
  PERSONA_LOCALES,
  PERSONA_OUTPUT_FORMATS,
  type BuildPersonaMatrixOptions,
  type CompiledPersonaJson,
  type CompiledPersonaVariant,
  type CompilePersonaOptions,
  type PersonaIntensity,
  type PersonaLocale,
  type PersonaManifestV1,
  type PersonaOutputFormat,
} from "./types.js";

export const MAX_COMPILED_PROMPT_WORDS = 1200;

interface NormalizedCompileOptions {
  readonly locale: PersonaLocale;
  readonly intensity: PersonaIntensity;
  readonly format: PersonaOutputFormat;
}

interface LocalizedLabels {
  readonly persona: string;
  readonly summary: string;
  readonly priority: string;
  readonly priorityText: string;
  readonly identity: string;
  readonly intensity: string;
  readonly traits: string;
  readonly principles: string;
  readonly goals: string;
  readonly rules: string;
  readonly safety: string;
  readonly avoid: string;
  readonly examples: string;
  readonly user: string;
  readonly assistant: string;
}

const LABELS: Readonly<Record<PersonaLocale, LocalizedLabels>> = {
  en: {
    persona: "PERSONA",
    summary: "SUMMARY",
    priority: "OPERATING PRIORITY",
    priorityText:
      "Follow this order of precedence: task correctness and usefulness, safety, persona behavior, then decorative language. Never sacrifice factual accuracy or task completion to stay in character.",
    identity: "IDENTITY",
    intensity: "INTENSITY",
    traits: "TRAITS",
    principles: "PRINCIPLES",
    goals: "GOALS",
    rules: "RULES",
    safety: "SAFETY",
    avoid: "AVOID",
    examples: "STYLE EXAMPLES",
    user: "User",
    assistant: "Assistant",
  },
  ru: {
    persona: "ПЕРСОНА",
    summary: "КРАТКОЕ ОПИСАНИЕ",
    priority: "ПРИОРИТЕТЫ РАБОТЫ",
    priorityText:
      "Соблюдай следующий порядок приоритетов: корректность и полезность решения задачи, безопасность, поведение персоны, затем декоративная речь. Никогда не жертвуй точностью фактов или выполнением задачи ради образа.",
    identity: "ОБРАЗ",
    intensity: "ИНТЕНСИВНОСТЬ",
    traits: "ЧЕРТЫ",
    principles: "ПРИНЦИПЫ",
    goals: "ЦЕЛИ",
    rules: "ПРАВИЛА",
    safety: "БЕЗОПАСНОСТЬ",
    avoid: "ИЗБЕГАТЬ",
    examples: "ПРИМЕРЫ СТИЛЯ",
    user: "Пользователь",
    assistant: "Ассистент",
  },
};

interface PromptSection {
  readonly heading: string;
  readonly paragraphs?: readonly string[];
  readonly bullets?: readonly string[];
}

function buildSections(
  manifest: PersonaManifestV1,
  locale: PersonaLocale,
  intensity: PersonaIntensity,
): readonly PromptSection[] {
  const labels = LABELS[locale];
  const content = manifest.locales[locale];
  const examples = content.examples.flatMap((example) => [
    `${labels.user}: ${example.user}`,
    `${labels.assistant}: ${example.assistant}`,
  ]);

  return [
    { heading: labels.summary, paragraphs: [content.summary] },
    { heading: labels.priority, paragraphs: [labels.priorityText] },
    { heading: labels.identity, paragraphs: [content.basePrompt] },
    { heading: labels.intensity, paragraphs: [manifest.intensity[intensity][locale]] },
    { heading: labels.traits, bullets: content.traits },
    { heading: labels.principles, bullets: content.principles },
    { heading: labels.goals, bullets: manifest.behavior.goals[locale] },
    { heading: labels.rules, bullets: manifest.behavior.rules[locale] },
    { heading: labels.safety, bullets: manifest.safety.rules[locale] },
    { heading: labels.avoid, bullets: manifest.behavior.avoid[locale] },
    { heading: labels.examples, paragraphs: examples },
  ];
}

function renderText(
  manifest: PersonaManifestV1,
  locale: PersonaLocale,
  intensity: PersonaIntensity,
): string {
  const labels = LABELS[locale];
  const content = manifest.locales[locale];
  const output = [`${labels.persona}: ${content.name}`];

  for (const section of buildSections(manifest, locale, intensity)) {
    output.push("", section.heading);
    if (section.paragraphs) {
      output.push(...section.paragraphs);
    }
    if (section.bullets) {
      output.push(...section.bullets.map((item) => `- ${item}`));
    }
  }

  return `${output.join("\n")}\n`;
}

function renderMarkdown(
  manifest: PersonaManifestV1,
  locale: PersonaLocale,
  intensity: PersonaIntensity,
): string {
  const labels = LABELS[locale];
  const content = manifest.locales[locale];
  const output = [`# ${labels.persona}: ${content.name}`];

  for (const section of buildSections(manifest, locale, intensity)) {
    output.push("", `## ${section.heading}`);
    if (section.paragraphs) {
      output.push("", ...section.paragraphs.map((paragraph) => `${paragraph}\n`));
    }
    if (section.bullets) {
      output.push("", ...section.bullets.map((item) => `- ${item}`));
    }
  }

  return `${output.join("\n").trimEnd()}\n`;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

function assertPromptLength(id: string, locale: PersonaLocale, text: string): void {
  const words = wordCount(text);
  if (words > MAX_COMPILED_PROMPT_WORDS) {
    throw new PersonaSourceError(
      `Compiled prompt for ${id}/${locale} contains ${words} words; maximum is ${MAX_COMPILED_PROMPT_WORDS}.`,
    );
  }
}

function buildCompiledPersonaJson(
  manifest: PersonaManifestV1,
  locale: PersonaLocale,
  intensity: PersonaIntensity,
  prompt: string,
): CompiledPersonaJson {
  return {
    schemaVersion: "1.0.0",
    id: manifest.id,
    version: manifest.version,
    locale,
    intensity,
    name: manifest.locales[locale].name,
    summary: manifest.locales[locale].summary,
    greeting: manifest.locales[locale].greeting,
    safetyRating: manifest.safety.rating,
    prompt,
    license: manifest.license,
    attribution: manifest.attribution,
  };
}

function describeRuntimeValue(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function normalizeCompileOptions(
  options: Omit<CompilePersonaOptions, "personasDirectory">,
): NormalizedCompileOptions {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new PersonaSourceError("Persona compile options must be an object.");
  }

  const candidate = options as Readonly<Record<string, unknown>>;
  const locale = candidate.locale ?? "en";
  const intensity = candidate.intensity ?? "balanced";
  const format = candidate.format ?? "text";

  if (typeof locale !== "string" || !isPersonaLocale(locale)) {
    throw new PersonaSourceError(`Unsupported persona locale: ${describeRuntimeValue(locale)}.`);
  }
  if (typeof intensity !== "string" || !isPersonaIntensity(intensity)) {
    throw new PersonaSourceError(
      `Unsupported persona intensity: ${describeRuntimeValue(intensity)}.`,
    );
  }
  if (typeof format !== "string" || !isPersonaOutputFormat(format)) {
    throw new PersonaSourceError(`Unsupported persona output format: ${describeRuntimeValue(format)}.`);
  }

  return { locale, intensity, format };
}

function compileValidatedPersonaManifest(
  manifest: PersonaManifestV1,
  { locale, intensity, format }: NormalizedCompileOptions,
): string {
  const text = renderText(manifest, locale, intensity);
  assertPromptLength(manifest.id, locale, text);

  if (format === "text") {
    return text;
  }
  if (format === "markdown") {
    return renderMarkdown(manifest, locale, intensity);
  }

  const compiled = buildCompiledPersonaJson(manifest, locale, intensity, text);
  return `${JSON.stringify(compiled, null, 2)}\n`;
}

export function compilePersonaManifest(
  manifest: PersonaManifestV1,
  options: Omit<CompilePersonaOptions, "personasDirectory"> = {},
): string {
  const validatedManifest = validatePersonaManifest(manifest);
  return compileValidatedPersonaManifest(validatedManifest, normalizeCompileOptions(options));
}

export function compilePersona(id: string, options: CompilePersonaOptions = {}): string {
  const normalizedOptions = normalizeCompileOptions(options);
  return compileValidatedPersonaManifest(getPersona(id, options), normalizedOptions);
}

function assertExpectedPersonas(actualIds: readonly string[], expectedIds: readonly string[]): void {
  const actual = [...actualIds].sort((left, right) => left.localeCompare(right, "en"));
  const expected = [...expectedIds].sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new PersonaSourceError(
      `Built-in persona set mismatch. Expected [${expected.join(", ")}], received [${actual.join(", ")}].`,
    );
  }
}

export function buildPersonaMatrix(
  options: BuildPersonaMatrixOptions = {},
): readonly CompiledPersonaVariant[] {
  const expectedIds = options.expectedPersonaIds ?? BUILT_IN_PERSONA_IDS;
  const actualIds = listPersonas(options).map((persona) => persona.id);
  assertExpectedPersonas(actualIds, expectedIds);
  const manifests = actualIds.map((id) => getPersona(id, options));

  const variants: CompiledPersonaVariant[] = [];
  for (const manifest of manifests.sort((left, right) => left.id.localeCompare(right.id, "en"))) {
    for (const locale of PERSONA_LOCALES) {
      for (const intensity of PERSONA_INTENSITIES) {
        const text = compileValidatedPersonaManifest(manifest, {
          locale,
          intensity,
          format: "text",
        });
        variants.push({
          id: manifest.id,
          locale,
          intensity,
          text,
          markdown: compileValidatedPersonaManifest(manifest, {
            locale,
            intensity,
            format: "markdown",
          }),
          json: buildCompiledPersonaJson(manifest, locale, intensity, text),
        });
      }
    }
  }

  return variants;
}

export function isPersonaLocale(value: string): value is PersonaLocale {
  return (PERSONA_LOCALES as readonly string[]).includes(value);
}

export function isPersonaIntensity(value: string): value is PersonaIntensity {
  return (PERSONA_INTENSITIES as readonly string[]).includes(value);
}

export function isPersonaOutputFormat(value: string): value is PersonaOutputFormat {
  return (PERSONA_OUTPUT_FORMATS as readonly string[]).includes(value);
}
