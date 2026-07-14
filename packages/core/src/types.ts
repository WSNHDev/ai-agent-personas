export const PERSONA_LOCALES = ["en", "ru"] as const;
export const PERSONA_INTENSITIES = ["subtle", "balanced", "immersive"] as const;
export const PERSONA_OUTPUT_FORMATS = ["text", "markdown", "json"] as const;
export const BUILT_IN_PERSONA_IDS = [
  "butler",
  "catgirl",
  "detective",
  "knight",
  "teacher",
  "wizard",
  "yandere",
] as const;

export type PersonaLocale = (typeof PERSONA_LOCALES)[number];
export type PersonaIntensity = (typeof PERSONA_INTENSITIES)[number];
export type PersonaOutputFormat = (typeof PERSONA_OUTPUT_FORMATS)[number];
export type BuiltInPersonaId = (typeof BUILT_IN_PERSONA_IDS)[number];

export interface PersonaExample {
  readonly user: string;
  readonly assistant: string;
}

export interface PersonaLocaleContent {
  readonly name: string;
  readonly summary: string;
  readonly greeting: string;
  readonly traits: readonly string[];
  readonly principles: readonly string[];
  readonly basePrompt: string;
  readonly examples: readonly PersonaExample[];
}

export interface LocalizedString {
  readonly en: string;
  readonly ru: string;
}

export interface LocalizedStringArray {
  readonly en: readonly string[];
  readonly ru: readonly string[];
}

export interface PersonaBehavior {
  readonly goals: LocalizedStringArray;
  readonly rules: LocalizedStringArray;
  readonly avoid: LocalizedStringArray;
}

export interface PersonaSafety {
  readonly rating: "SFW";
  readonly rules: LocalizedStringArray;
}

export interface PersonaIntensityDirectives {
  readonly subtle: LocalizedString;
  readonly balanced: LocalizedString;
  readonly immersive: LocalizedString;
}

export interface PersonaManifestV1 {
  readonly schemaVersion: "1.0.0";
  readonly id: string;
  readonly version: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly color: string;
  readonly locales: Readonly<Record<PersonaLocale, PersonaLocaleContent>>;
  readonly behavior: PersonaBehavior;
  readonly safety: PersonaSafety;
  readonly intensity: PersonaIntensityDirectives;
  readonly license: "CC-BY-4.0";
  readonly attribution: string;
}

export interface PersonaSourceOptions {
  readonly personasDirectory?: string;
}

export interface PersonaSummary {
  readonly id: string;
  readonly version: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly color: string;
  readonly name: Readonly<Record<PersonaLocale, string>>;
  readonly summary: Readonly<Record<PersonaLocale, string>>;
  readonly safetyRating: "SFW";
}

export interface CompilePersonaOptions extends PersonaSourceOptions {
  readonly locale?: PersonaLocale;
  readonly intensity?: PersonaIntensity;
  readonly format?: PersonaOutputFormat;
}

export interface CompiledPersonaJson {
  readonly schemaVersion: "1.0.0";
  readonly id: string;
  readonly version: string;
  readonly locale: PersonaLocale;
  readonly intensity: PersonaIntensity;
  readonly name: string;
  readonly summary: string;
  readonly greeting: string;
  readonly safetyRating: "SFW";
  readonly prompt: string;
  readonly license: "CC-BY-4.0";
  readonly attribution: string;
}

export interface CompiledPersonaVariant {
  readonly id: string;
  readonly locale: PersonaLocale;
  readonly intensity: PersonaIntensity;
  readonly text: string;
  readonly markdown: string;
  readonly json: CompiledPersonaJson;
}

export interface BuildPersonaMatrixOptions extends PersonaSourceOptions {
  readonly expectedPersonaIds?: readonly string[];
}

export interface PersonaPathValidationFailure {
  readonly file: string;
  readonly message: string;
  readonly issues: readonly import("./errors.js").PersonaValidationIssue[];
}

export interface PersonaPathValidationReport {
  readonly valid: boolean;
  readonly checked: number;
  readonly personaIds: readonly string[];
  readonly failures: readonly PersonaPathValidationFailure[];
}
