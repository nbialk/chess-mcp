import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Lint the TypeScript app source only. Build output, generated agent
    // shims, and tooling scripts run in their own environments and are not
    // part of the app surface.
    ignores: [
      "dist",
      "node_modules",
      ".skybridge",
      ".next",
      ".vercel",
      "public",
      "plans",
      "scripts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      // The two correctness rules; the rest of react-hooks v7's recommended
      // set is stylistic/opinionated and out of scope for this gate.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
