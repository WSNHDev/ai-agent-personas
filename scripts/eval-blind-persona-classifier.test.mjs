import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildBlindPersonaClassifierPrompt,
  gradeBlindPersonaLabel,
  parseBlindPersonaLabel,
  PERSONA_CLASSIFIER_LABELS,
} from '../evals/assertions/blind-persona-classifier.mjs';
import { gradePairedPersonaContrast } from '../evals/assertions/paired-persona-contrast.mjs';

test('blind persona classifier exposes exactly seven canonical labels plus unclear', () => {
  assert.deepEqual(PERSONA_CLASSIFIER_LABELS, [
    'teacher',
    'catgirl',
    'yandere',
    'wizard',
    'detective',
    'butler',
    'knight',
    'unclear',
  ]);
});

test('blind classifier prompt contains no expected-label field or target-specific cue list', () => {
  const output = 'We will trace the facts, separate observation from inference, and state confidence.';
  const prompt = buildBlindPersonaClassifierPrompt(output);
  const messages = JSON.parse(prompt);

  assert.equal(messages.length, 2);
  assert.match(messages[0].content, /Choose exactly one label from:/u);
  assert.match(messages[0].content, /topic, technical nouns, factual content/u);
  assert.doesNotMatch(messages[0].content, /expected|target persona|rune|purr|honorific/ui);
  assert.match(messages[1].content, new RegExp(output.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
});

test('blind classifier parser accepts only an exact canonical label', () => {
  assert.equal(parseBlindPersonaLabel({ output: 'wizard' }), 'wizard');
  assert.throws(() => parseBlindPersonaLabel({ output: 'wizard\nBecause of the imagery.' }), {
    name: 'TypeError',
  });
  assert.throws(() => parseBlindPersonaLabel({ output: 'mage' }), { name: 'TypeError' });
});

test('expected and matched-control labels are compared only after blind classification', () => {
  assert.equal(gradeBlindPersonaLabel('wizard', { expectedLabel: 'wizard' }).pass, true);
  assert.equal(gradeBlindPersonaLabel('teacher', { forbiddenLabel: 'wizard' }).pass, true);
  assert.equal(gradeBlindPersonaLabel('wizard', { forbiddenLabel: 'wizard' }).pass, false);
  assert.throws(() => gradeBlindPersonaLabel('wizard', {}), { name: 'TypeError' });
  assert.throws(
    () =>
      gradeBlindPersonaLabel('wizard', {
        expectedLabel: 'wizard',
        forbiddenLabel: 'wizard',
      }),
    { name: 'TypeError' },
  );
});

test('paired contrast requires a target hit in Voice and no target hit in unchanged Control', () => {
  assert.deepEqual(
    gradePairedPersonaContrast(
      { voiceLabel: 'wizard', controlLabel: 'unclear' },
      { targetLabel: 'wizard' },
    ),
    {
      pass: true,
      score: 1,
      reason: 'Matched target-label contrast passed: Voice=wizard, unchanged Control=unclear.',
    },
  );
  assert.equal(
    gradePairedPersonaContrast(
      { voiceLabel: 'wizard', controlLabel: 'wizard' },
      { targetLabel: 'wizard' },
    ).pass,
    false,
  );
  assert.equal(
    gradePairedPersonaContrast(
      { voiceLabel: 'unclear', controlLabel: 'unclear' },
      { targetLabel: 'wizard' },
    ).pass,
    false,
  );
  assert.throws(
    () =>
      gradePairedPersonaContrast(
        { voiceLabel: 'unclear', controlLabel: 'unclear' },
        { targetLabel: 'unclear' },
      ),
    { name: 'TypeError' },
  );
});

function scalar(block, key) {
  return block.match(new RegExp(`^\\s+${key}:\\s+([^\\s#]+)\\s*$`, 'mu'))?.[1];
}

test('recognizability suite contains seven exact matched Voice/Control pairs', async () => {
  const yaml = await readFile(new URL('../evals/tests.yaml', import.meta.url), 'utf8');
  const cases = yaml
    .split(/(?=^- description: )/mu)
    .filter((block) => /^- description: /u.test(block));
  const recognitionCases = cases.filter((block) => /recognizabilityArm:/u.test(block));
  assert.equal(recognitionCases.length, 14);

  const byWorkload = Map.groupBy(recognitionCases, (block) => scalar(block, 'workloadId'));
  assert.equal(byWorkload.size, 7);

  const targets = new Set();
  for (const [workloadId, blocks] of byWorkload) {
    assert.ok(workloadId, 'every recognition case has a workloadId');
    assert.equal(blocks.length, 2, `${workloadId} must have exactly two arms`);
    const control = blocks.find((block) => scalar(block, 'recognizabilityArm') === 'control');
    const voice = blocks.find((block) => scalar(block, 'recognizabilityArm') === 'voice');
    assert.ok(control, `${workloadId} is missing Control`);
    assert.ok(voice, `${workloadId} is missing Voice`);

    const target = scalar(voice, 'persona');
    targets.add(target);
    assert.equal(scalar(control, 'persona'), target, `${workloadId} persona drift`);
    assert.equal(scalar(control, 'locale'), scalar(voice, 'locale'), `${workloadId} locale drift`);
    assert.equal(
      scalar(control, 'intensity'),
      scalar(voice, 'intensity'),
      `${workloadId} intensity drift`,
    );
    assert.equal(scalar(control, 'presentationMode'), 'neutral');
    assert.equal(scalar(voice, 'presentationMode'), 'persona');

    const sourceAnchor = control.match(/^\s+sourceAnswer:\s+&([^\s]+)\s+>-\s*$/mu)?.[1];
    assert.ok(sourceAnchor, `${workloadId} Control must own the shared source anchor`);
    assert.match(
      control,
      new RegExp(`^\\s+providerOutput:\\s+\\*${sourceAnchor}\\s*$`, 'mu'),
      `${workloadId} Control must return the unchanged shared source`,
    );
    assert.match(
      voice,
      new RegExp(`^\\s+sourceAnswer:\\s+\\*${sourceAnchor}\\s*$`, 'mu'),
      `${workloadId} Voice must consume the same shared source`,
    );

    assert.match(control, /file:\/\/assertions\/blind-persona-classifier\.mjs/u);
    assert.match(control, new RegExp(`forbiddenLabel:\\s+${target}(?:\\s|$)`, 'u'));
    assert.doesNotMatch(control, /expectedLabel:/u);
    assert.match(voice, /file:\/\/assertions\/blind-persona-classifier\.mjs/u);
    assert.match(voice, new RegExp(`expectedLabel:\\s+${target}(?:\\s|$)`, 'u'));
    assert.doesNotMatch(voice, /forbiddenLabel:/u);
    assert.match(voice, /file:\/\/assertions\/paired-persona-contrast\.mjs/u);
    assert.match(voice, new RegExp(`targetLabel:\\s+${target}(?:\\s|$)`, 'u'));
  }

  assert.deepEqual(
    [...targets].sort(),
    ['butler', 'catgirl', 'detective', 'knight', 'teacher', 'wizard', 'yandere'],
  );
});

test('neutral override and archetype-specific safety cases remain in the eval suite', async () => {
  const yaml = await readFile(new URL('../evals/tests.yaml', import.meta.url), 'utf8');
  const cases = yaml
    .split(/(?=^- description: )/mu)
    .filter((block) => /^- description: /u.test(block));
  const neutral = cases.find((block) =>
    block.startsWith('- description: Yandere RU Voice — neutral request remains neutral'),
  );
  assert.ok(neutral);
  assert.match(neutral, /^\s+presentationMode:\s+neutral\s*$/mu);
  assert.match(neutral, /^\s+expectedLabel:\s+unclear\s*$/mu);

  const safetyPersonas = cases
    .filter((block) => /^\s+evalStage:\s+safety\s*$/mu.test(block))
    .map((block) => scalar(block, 'persona'))
    .sort();
  assert.deepEqual(safetyPersonas, ['butler', 'catgirl', 'knight', 'yandere']);
});
