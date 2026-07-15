export const PERSONA_LOCALES = ["en", "ru"] as const;
export const PERSONA_INTENSITIES = ["subtle", "balanced", "immersive"] as const;
export const PERSONA_VOICE_PRESENTATIONS = ["persona", "neutral"] as const;
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
export type PersonaVoicePresentation = (typeof PERSONA_VOICE_PRESENTATIONS)[number];
export type PersonaOutputFormat = (typeof PERSONA_OUTPUT_FORMATS)[number];
export type BuiltInPersonaId = (typeof BUILT_IN_PERSONA_IDS)[number];

export type PersonaManifestSchemaVersion = "1.0.0" | "2.0.0";
export type PersonaLayer = "safety" | "task" | "voice";

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

export interface PersonaDisplayV2 {
  readonly name: LocalizedString;
  readonly summary: LocalizedString;
  readonly greeting: LocalizedString;
}

export interface PersonaSafetyV2 {
  readonly rating: "SFW";
  readonly risks: LocalizedStringArray;
  readonly preActionRules: LocalizedStringArray;
  readonly boundaries: LocalizedStringArray;
}

export interface PersonaTaskModeV2 {
  readonly id: string;
  readonly name: LocalizedString;
  readonly summary: LocalizedString;
  readonly suitability: LocalizedStringArray;
  readonly exclusions: LocalizedStringArray;
  readonly instructions: LocalizedStringArray;
}

export interface PersonaVoiceExampleV2 {
  readonly id: string;
  readonly source: LocalizedString;
  readonly rendered: LocalizedString;
}

export interface PersonaVoiceV2 {
  readonly directions: LocalizedStringArray;
  readonly avoid: LocalizedStringArray;
  readonly intensity: PersonaIntensityDirectives;
  readonly examples: readonly PersonaVoiceExampleV2[];
}

export interface PersonaManifestV2 {
  readonly schemaVersion: "2.0.0";
  readonly id: string;
  readonly version: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly color: string;
  readonly display: PersonaDisplayV2;
  readonly safety: PersonaSafetyV2;
  readonly taskModes: readonly PersonaTaskModeV2[];
  readonly voice: PersonaVoiceV2;
  readonly compatibility: {
    readonly legacyTaskModeId: string;
  };
  readonly license: "CC-BY-4.0";
  readonly attribution: string;
}

export type PersonaManifest = PersonaManifestV1 | PersonaManifestV2;

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

export type CompileLegacyPersonaOptions = CompilePersonaOptions;

export interface CompilePersonaSafetyOptions extends PersonaSourceOptions {
  readonly locale?: PersonaLocale;
  readonly format?: PersonaOutputFormat;
}

export interface CompilePersonaVoiceOptions extends PersonaSourceOptions {
  readonly locale?: PersonaLocale;
  readonly intensity?: PersonaIntensity;
  readonly format?: PersonaOutputFormat;
}

export interface BuildPersonaVoiceMessagesOptions extends PersonaSourceOptions {
  readonly locale?: PersonaLocale;
  readonly intensity?: PersonaIntensity;
  /** Trusted host control. Source-answer text can never select this mode. */
  readonly presentation?: PersonaVoicePresentation;
}

export interface CompilePersonaTaskModeOptions extends PersonaSourceOptions {
  readonly locale?: PersonaLocale;
  readonly taskModeId: string;
  readonly format?: PersonaOutputFormat;
}

export interface ListPersonaTaskModesOptions extends PersonaSourceOptions {
  readonly locale?: PersonaLocale;
}

export interface CompilePersonaLayersOptions extends PersonaSourceOptions {
  readonly locale?: PersonaLocale;
  readonly intensity?: PersonaIntensity;
  readonly taskModeId?: string;
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

export interface CompiledPersonaLayerJsonBase {
  readonly schemaVersion: "2.0.0";
  readonly manifestSchemaVersion: "2.0.0";
  readonly id: string;
  readonly version: string;
  readonly locale: PersonaLocale;
  readonly personaName: string;
  readonly personaSummary: string;
  readonly safetyRating: "SFW";
  readonly prompt: string;
  readonly license: "CC-BY-4.0";
  readonly attribution: string;
}

export type CompiledPersonaLayerJson =
  | (CompiledPersonaLayerJsonBase & {
      readonly layer: "voice";
      readonly intensity: PersonaIntensity;
      readonly taskModeId?: never;
    })
  | (CompiledPersonaLayerJsonBase & {
      readonly layer: "safety";
      readonly intensity?: never;
      readonly taskModeId?: never;
    })
  | (CompiledPersonaLayerJsonBase & {
      readonly layer: "task";
      readonly taskModeId: string;
      readonly taskModeName: string;
      readonly taskModeSummary: string;
      readonly intensity?: never;
    });

export interface PersonaTaskModeSummary {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly suitability: readonly string[];
  readonly exclusions: readonly string[];
}

export type PersonaVoiceMessages = readonly [
  { readonly role: "system"; readonly content: string },
  { readonly role: "user"; readonly content: string },
];

export interface CompiledPersonaLayers {
  readonly manifestSchemaVersion: "2.0.0";
  readonly id: string;
  readonly version: string;
  readonly locale: PersonaLocale;
  readonly safety: {
    readonly layer: "safety";
    readonly prompt: string;
  };
  readonly voice: {
    readonly layer: "voice";
    readonly intensity: PersonaIntensity;
    readonly prompt: string;
  };
  readonly taskMode: null | {
    readonly layer: "task";
    readonly taskModeId: string;
    readonly name: string;
    readonly summary: string;
    readonly prompt: string;
  };
}

export interface PersonaLayerMatrixEntry {
  readonly manifestSchemaVersion: "2.0.0";
  readonly id: string;
  readonly version: string;
  readonly locale: PersonaLocale;
  readonly safety: {
    readonly layer: "safety";
    readonly prompt: string;
  };
  readonly voice: Readonly<
    Record<
      PersonaIntensity,
      {
        readonly layer: "voice";
        readonly intensity: PersonaIntensity;
        readonly prompt: string;
      }
    >
  >;
  readonly taskModes: readonly {
    readonly layer: "task";
    readonly taskModeId: string;
    readonly name: string;
    readonly summary: string;
    readonly prompt: string;
  }[];
}

export interface LayerFileSet {
  readonly text: string;
  readonly markdown: string;
  readonly json: string;
}

export interface LayerCatalogV2 {
  readonly schemaVersion: "2.0.0";
  readonly manifestSchemaVersion: "2.0.0";
  readonly personas: readonly {
    readonly id: string;
    readonly version: string;
    readonly category: string;
    readonly tags: readonly string[];
    readonly color: string;
    readonly name: LocalizedString;
    readonly summary: LocalizedString;
    readonly safetyRating: "SFW";
    readonly taskModes: readonly {
      readonly id: string;
      readonly name: LocalizedString;
      readonly summary: LocalizedString;
    }[];
  }[];
  readonly entries: readonly {
    readonly id: string;
    readonly personaVersion: string;
    readonly locale: PersonaLocale;
    readonly files: {
      readonly safety: LayerFileSet;
      readonly voice: Readonly<Record<PersonaIntensity, LayerFileSet>>;
      readonly taskModes: readonly {
        readonly id: string;
        readonly files: LayerFileSet;
      }[];
    };
  }[];
}

export interface BuildPersonaMatrixOptions extends PersonaSourceOptions {
  readonly expectedPersonaIds?: readonly string[];
}

export type BuildPersonaLayerMatrixOptions = BuildPersonaMatrixOptions;

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
