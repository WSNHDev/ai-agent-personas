import { compilePersona } from '../packages/core/dist/index.js';

export default async function buildPersonaPrompt({ vars }) {
  const systemPrompt = compilePersona(vars.persona, {
    locale: vars.locale,
    intensity: vars.intensity,
  });

  return JSON.stringify([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: vars.userPrompt },
  ]);
}
