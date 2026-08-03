import { defineConfig } from "vite-plus"

// Mirrors the Form Factory devtools standard (oxlint + oxfmt via `vp check`).
export default defineConfig({
  lint: {
    plugins: ["typescript", "import"],
    rules: {
      "no-debugger": "error",
      "no-var": "error",
      "no-eval": "error",
      "prefer-const": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-unused-vars": "warn",
      "no-console": "off",
      "import/no-duplicates": "error",
      "import/no-self-import": "error",
      "import/no-cycle": "warn",
      "typescript/no-explicit-any": "warn",
      "typescript/no-non-null-assertion": "warn",
      "typescript/no-unused-vars": "warn",
      "typescript/consistent-type-assertions": [
        "error",
        { assertionStyle: "never" },
      ],
    },
    ignorePatterns: ["**/node_modules/", "**/dist/", "**/bin/", "**/coverage/"],
    overrides: [
      {
        files: ["**/*.test.ts", "**/*.spec.ts"],
        rules: {
          "typescript/consistent-type-assertions": "off",
          "typescript/no-explicit-any": "off",
        },
      },
    ],
  },
  fmt: {
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    semi: false,
    singleQuote: false,
    trailingComma: "all",
    bracketSpacing: true,
    arrowParens: "always",
    endOfLine: "lf",
  },
  staged: {
    "*.{js,ts,json,md}": "vp check --fix",
  },
})
