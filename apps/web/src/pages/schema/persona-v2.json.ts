import { getPersonaSchemaV2 } from "@ai-agent-personas/core";

export const prerender = true;

export function GET(): Response {
  return new Response(`${JSON.stringify(getPersonaSchemaV2(), null, 2)}\n`, {
    headers: {
      "content-type": "application/schema+json; charset=utf-8",
    },
  });
}
