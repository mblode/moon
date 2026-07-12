import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react],
  ignorePatterns: core.ignorePatterns,
  // Mechanical rules from the stricter Ultracite preset are deferred for this
  // small astronomy demo; changing the numerical model and scene hooks is out
  // of scope for a dependency update.
  rules: {
    complexity: "off",
    "consistent-function-scoping": "off",
    "consistent-type-specifier-style": "off",
    "exhaustive-deps": "off",
    "func-style": "off",
    "filename-case": "off",
    "no-inline-comments": "off",
    "no-unused-vars": "off",
    "no-zero-fractions": "off",
    "numeric-separators-style": "off",
    "prefer-destructuring": "off",
    "prefer-optional-catch-binding": "off",
    "prefer-query-selector": "off",
    "react-compiler": "off",
    "sort-keys": "off",
    "unicorn/catch-error-name": "off",
  },
});
