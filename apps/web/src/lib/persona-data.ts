import {
  compilePersona,
  getPersona,
  listPersonas,
  type PersonaIntensity,
  type PersonaLocale,
  type PersonaManifestV1,
} from "@ai-agent-personas/core";
import { intensities, locales } from "@/lib/site";

export type CompiledPromptMap = Record<
  PersonaLocale,
  Record<PersonaIntensity, string>
>;

export function loadPersonas(): PersonaManifestV1[] {
  return listPersonas().map(({ id }) => getPersona(id));
}

export function compilePromptMap(id: string): CompiledPromptMap {
  return Object.fromEntries(
    locales.map((locale) => [
      locale,
      Object.fromEntries(
        intensities.map((intensity) => [
          intensity,
          compilePersona(id, { locale, intensity, format: "text" }),
        ]),
      ),
    ]),
  ) as CompiledPromptMap;
}
