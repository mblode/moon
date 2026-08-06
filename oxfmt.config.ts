import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: ["**/*.md", "**/*.mdx", ".next/**", "next-env.d.ts"],
});
