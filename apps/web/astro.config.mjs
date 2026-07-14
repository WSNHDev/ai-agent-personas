import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://wsnhdev.github.io",
  base: "/ai-agent-personas",
  output: "static",
  trailingSlash: "always",
  build: {
    format: "directory",
  },
});
