import assert from "node:assert/strict";
import { test } from "node:test";

import buildLayerPrompt from "../evals/prompt.mjs";

test("Voice evaluation reuses the supplied answer as an isolated renderer payload", async () => {
  const sourceAnswer = "Fact one. Fact two.";
  const messages = JSON.parse(
    await buildLayerPrompt({
      vars: {
        evalStage: "voice",
        persona: "teacher",
        locale: "en",
        intensity: "balanced",
        sourceAnswer,
      },
    }),
  );

  assert.deepEqual(messages.map(({ role }) => role), ["system", "user"]);
  assert.match(messages[0].content, /PRESENTATION: PERSONA/u);
  assert.equal(JSON.parse(messages[1].content).sourceAnswer, sourceAnswer);
});

test("Voice evaluation carries neutral presentation through trusted host control", async () => {
  const sourceAnswer = "Keep this answer literal.";
  const messages = JSON.parse(
    await buildLayerPrompt({
      vars: {
        evalStage: "voice",
        persona: "yandere",
        locale: "en",
        intensity: "balanced",
        presentationMode: "neutral",
        sourceAnswer,
      },
    }),
  );

  assert.match(messages[0].content, /PRESENTATION: NEUTRAL/u);
  assert.match(messages[0].content, /byte-for-byte unchanged/u);
  assert.equal(JSON.parse(messages[1].content).sourceAnswer, sourceAnswer);
});

test("Task evaluation accepts only a preregistered aligned family", async () => {
  const messages = JSON.parse(
    await buildLayerPrompt({
      vars: {
        evalStage: "task",
        persona: "detective",
        locale: "en",
        taskMode: "detective-root-cause",
        taskFamily: "debugging",
        userPrompt: "Investigate the supplied evidence.",
      },
    }),
  );
  assert.deepEqual(messages.map(({ role }) => role), ["system", "system", "user"]);

  await assert.rejects(
    buildLayerPrompt({
      vars: {
        evalStage: "task",
        persona: "detective",
        locale: "en",
        taskMode: "detective-root-cause",
        taskFamily: "strict-extraction",
        userPrompt: "Extract the supplied fields.",
      },
    }),
    /requires a preregistered aligned family/,
  );
});
