import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [...compat.extends("eslint:recommended"), {
    languageOptions: {
        globals: {
            "__VERSION__": true,
            ...globals.browser,
        },

        ecmaVersion: 2017,
        sourceType: "module",
    },
    rules: {
        indent: ["error", 4],
        "linebreak-style": ["error", "unix"],
        quotes: ["error", "single"],
        semi: ["error", "always"],
        curly: ["error", "all"],
        "no-warning-comments": "error",
        "no-unused-vars": ["error", {
            "caughtErrorsIgnorePattern": "ignored"
        }],
    },
}];
