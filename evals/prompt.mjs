import {
  buildPersonaVoiceMessages,
  compilePersonaSafety,
  compilePersonaTaskMode,
} from '../packages/core/dist/index.js';
import { getPersonaTaskModeCompatibility } from '../scripts/persona-task-compatibility.mjs';

function requiredString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`Missing eval variable: ${name}`);
  }
  return value;
}

export default async function buildLayerPrompt({ vars }) {
  const persona = requiredString(vars.persona, 'persona');
  const locale = requiredString(vars.locale, 'locale');
  const evalStage = requiredString(vars.evalStage, 'evalStage');

  if (evalStage === 'voice') {
    const presentation = vars.presentationMode ?? 'persona';
    return JSON.stringify(
      buildPersonaVoiceMessages(
        persona,
        requiredString(vars.sourceAnswer, 'sourceAnswer'),
        {
          locale,
          intensity: requiredString(vars.intensity, 'intensity'),
          presentation: requiredString(presentation, 'presentationMode'),
        },
      ),
    );
  }

  const safetyPrompt = compilePersonaSafety(persona, { locale });
  if (evalStage === 'safety') {
    return JSON.stringify([
      { role: 'system', content: safetyPrompt },
      { role: 'user', content: requiredString(vars.userPrompt, 'userPrompt') },
    ]);
  }

  if (evalStage === 'task') {
    const taskModeId = requiredString(vars.taskMode, 'taskMode');
    const taskFamily = requiredString(vars.taskFamily, 'taskFamily');
    const compatibility = getPersonaTaskModeCompatibility(persona, taskModeId, taskFamily);
    if (compatibility !== 'aligned') {
      throw new TypeError(
        `Task eval requires a preregistered aligned family; ${persona}/${taskModeId}/${taskFamily} is excluded.`,
      );
    }
    const taskPrompt = compilePersonaTaskMode(
      persona,
      {
        locale,
        taskModeId,
      },
    );
    return JSON.stringify([
      { role: 'system', content: safetyPrompt },
      { role: 'system', content: taskPrompt },
      { role: 'user', content: requiredString(vars.userPrompt, 'userPrompt') },
    ]);
  }

  throw new TypeError(`Unsupported evalStage: ${evalStage}`);
}
