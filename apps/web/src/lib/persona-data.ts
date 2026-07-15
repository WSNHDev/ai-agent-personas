import {
  compilePersonaLayers,
  getPersona,
  isPersonaManifestV2,
  listPersonaTaskModes,
  listPersonas,
  type PersonaIntensity,
  type PersonaLocale,
  type PersonaManifestV2,
} from "@ai-agent-personas/core";
import { intensities } from "@/lib/site";

export interface CompiledTaskModeData {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly suitability: readonly string[];
  readonly exclusions: readonly string[];
  readonly prompt: string;
}

export interface CompiledLocaleLayers {
  readonly safety: string;
  readonly voice: Readonly<Record<PersonaIntensity, string>>;
  readonly taskModes: readonly CompiledTaskModeData[];
}

export type CompiledLayerMap = Readonly<Record<PersonaLocale, CompiledLocaleLayers>>;

export function loadPersonas(): PersonaManifestV2[] {
  return listPersonas().map(({ id }) => {
    const manifest = getPersona(id);
    if (!isPersonaManifestV2(manifest)) {
      throw new Error(`The website requires a v2 persona manifest: ${id}.`);
    }
    return manifest;
  });
}

function compileLocaleLayers(id: string, locale: PersonaLocale): CompiledLocaleLayers {
  const base = compilePersonaLayers(id, { locale, intensity: "balanced" });
  const voice = Object.fromEntries(
    intensities.map((intensity) => [
      intensity,
      intensity === "balanced"
        ? base.voice.prompt
        : compilePersonaLayers(id, { locale, intensity }).voice.prompt,
    ]),
  ) as Record<PersonaIntensity, string>;
  const taskModes = listPersonaTaskModes(id, { locale }).map((mode) => {
    const compiled = compilePersonaLayers(id, {
      locale,
      taskModeId: mode.id,
    }).taskMode;
    if (!compiled) {
      throw new Error(`Core did not compile requested Task mode ${id}/${mode.id}.`);
    }
    return {
      id: mode.id,
      name: mode.name,
      summary: mode.summary,
      suitability: mode.suitability,
      exclusions: mode.exclusions,
      prompt: compiled.prompt,
    };
  });

  return {
    safety: base.safety.prompt,
    voice,
    taskModes,
  };
}

export function compileLayerMap(id: string): CompiledLayerMap {
  return {
    en: compileLocaleLayers(id, "en"),
    ru: compileLocaleLayers(id, "ru"),
  };
}
