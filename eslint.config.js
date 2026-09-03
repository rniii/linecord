import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import { defineConfig } from "eslint/config";
import importSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";
import ts from "typescript-eslint";

export default defineConfig({
    files: ["src/**/*.ts", "scripts/**/*.ts", "decompiler/src/**/*.ts", "eslint.config.js"],

    plugins: {
        "@stylistic": stylistic,
        "unused-imports": unusedImports,
        "simple-import-sort": importSort,
    },

    extends: [
        js.configs.recommended,
        ts.configs.recommended,
        stylistic.configs.customize({
            indent: 4,
            quotes: "double",
            braceStyle: "1tbs",
            semi: true,
        }),
    ],

    rules: {
        "@stylistic/arrow-parens": ["error", "as-needed"],
        "@stylistic/generator-star-spacing": ["error", { before: true, after: false }],
        "@stylistic/no-mixed-operators": "off",
        "@stylistic/operator-linebreak": ["error", "before", { overrides: { "=": "after" } }],
        "@stylistic/quote-props": "off",
        "@stylistic/spaced-comment": ["error", "always", { markers: ["!", "#region", "#endregion"] }],

        "simple-import-sort/imports": "error",
        "simple-import-sort/exports": "error",
        "unused-imports/no-unused-imports": "error",

        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-expressions": "off",

        "no-useless-escape": "off",
        "no-var": "off",
        "prefer-const": ["error", { destructuring: "all" }],
    },
}, {
    // > When non-JS files are specified in the files property, ESLint still lints files
    // that match the default patterns. To lint only the files specified in the files
    // property, you must ignore the default file patterns:
    //
    // DIEEEEEEEEEEEEEEEEEe
    ignores: ["**/*.js", "**/*.cjs", "**/*.mjs"],
});
