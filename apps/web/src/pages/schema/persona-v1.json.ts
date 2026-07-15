import { getPersonaSchemaV1 } from "@ai-agent-personas/core";

export const prerender = true;

export function GET(): Response {
  return new Response(`${JSON.stringify(getPersonaSchemaV1(), null, 2)}\n`, {
    headers: {
      "cache-control": "public, max-age=3600, s-maxage=86400",
      "content-type": "application/schema+json; charset=utf-8",
    },
  });
}
