# Persona-neutral structured extraction workload v2

Purpose: detect unwanted cognitive or verbosity leakage on a task where the selected persona Task mode is preregistered as incompatible, while still producing a human-readable answer suitable for Voice UX comparison.

Registered family: `strict-extraction`.

## Solver contract

Given a frozen 1,000–1,500 word source document, return a concise Markdown artifact with exactly these headings, in this order:

1. `Dates`
2. `Named decisions`
3. `Open questions`

Under each heading, use bullets copied or directly paraphrased from the source in source order. Preserve every date, decision owner, qualifier, and unresolved question; add no advice, causal inference, or new fact. Use 120–220 words. No tools are available. Maximum autonomous schedule: two model requests.

## Renderer contract

`control-voice` must reuse the complete immutable `control` solver stage. Voice may adjust cadence, short transitions, and harmless presentation motifs, but must preserve the three headings, every bullet, bullet order, names, dates, qualifiers, unresolved status, and the word-bound contract. Both outputs remain eligible for randomized human preference and secondary UX ratings.

The `task-voice` arm is still executed as diagnostic leakage evidence, but the tracked compatibility matrix marks `strict-extraction` as incompatible with the selected Task mode. It therefore carries an explicit exclusion reason and does not enter the Task-benefit release check.

## Primary comparisons

- Isolation: `control` versus `control-voice` uses one identical solver stage, so only renderer cost, fidelity, and UX may differ.
- Leakage: `legacy-global` and excluded `task-voice` reveal whether persona instructions alter solving policy on a non-aligned task.
- Fidelity: Voice must not invent, omit, merge, or reorder extracted content.
