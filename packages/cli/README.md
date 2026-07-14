# AI Agent Personas

Portable, bilingual, tested persona prompts for AI agents and chat assistants.

```sh
npx ai-agent-personas list
npx ai-agent-personas show teacher --locale en --intensity balanced
npx ai-agent-personas copy wizard --locale ru --intensity immersive
npx ai-agent-personas export detective --format json --output detective.json
npx ai-agent-personas validate ./personas
```

The package also exposes the synchronous core API:

```ts
import { compilePersona, listPersonas } from "ai-agent-personas";

const catalog = listPersonas();
const prompt = compilePersona("teacher", {
  locale: "en",
  intensity: "balanced",
  format: "markdown",
});
```

The versioned manifest schema and precompiled catalog are available as package exports:

```js
import schema from "ai-agent-personas/schema" with { type: "json" };
import catalog from "ai-agent-personas/catalog.json" with { type: "json" };
```

This is a mixed-license package. See `LICENSES.md` for the exact file mapping,
`LICENSE` for MIT terms, `LICENSE-CONTENT.md` for CC BY 4.0 terms, and `NOTICE`
for attribution.

Project: <https://github.com/WSNHDev/ai-agent-personas>
