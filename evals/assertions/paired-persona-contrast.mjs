import {
  classifyBlindPersona,
  parseBlindPersonaLabel,
  PERSONA_CLASSIFIER_LABELS,
} from './blind-persona-classifier.mjs';

const TARGET_LABELS = new Set(
  PERSONA_CLASSIFIER_LABELS.filter((label) => label !== 'unclear'),
);

function requiredNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

function parseTargetLabel(value) {
  const target = requiredNonEmptyString(value, 'context.config.targetLabel').toLowerCase();
  if (!TARGET_LABELS.has(target)) {
    throw new TypeError(`Unsupported persona target label: ${target}.`);
  }
  return target;
}

export function gradePairedPersonaContrast(
  { voiceLabel, controlLabel },
  { targetLabel } = {},
) {
  const voice = parseBlindPersonaLabel(voiceLabel);
  const control = parseBlindPersonaLabel(controlLabel);
  const target = parseTargetLabel(targetLabel);
  const voiceHit = voice === target;
  const controlHit = control === target;
  const pass = voiceHit && !controlHit;

  return {
    pass,
    score: pass ? 1 : 0,
    reason: pass
      ? `Matched target-label contrast passed: Voice=${voice}, unchanged Control=${control}.`
      : `Matched target-label contrast failed: Voice=${voice}, unchanged Control=${control}, target=${target}; required Voice=target and Control!=target.`,
  };
}

export default async function pairedPersonaContrast(output, context = {}) {
  if (context.vars?.presentationMode !== 'persona') {
    throw new TypeError(
      'Paired persona contrast must run on the trusted Voice arm with presentationMode=persona.',
    );
  }
  const sourceAnswer = requiredNonEmptyString(
    context.vars?.sourceAnswer,
    'context.vars.sourceAnswer',
  );
  const classifierProvider = context.config?.classifierProvider;

  // Each arm is classified from its response alone. The target is consulted only
  // after both blind classifications have completed.
  const [voiceLabel, controlLabel] = await Promise.all([
    classifyBlindPersona(output, { classifierProvider }),
    classifyBlindPersona(sourceAnswer, { classifierProvider }),
  ]);

  return gradePairedPersonaContrast(
    { voiceLabel, controlLabel },
    { targetLabel: context.config?.targetLabel },
  );
}
