import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginUnusedImports from "eslint-plugin-unused-imports";
import parserTs from "@typescript-eslint/parser";

export default [
  {
    files: [
      "src/components/**/*.{js,mjs,cjs,jsx}",
      "src/pages/**/*.{js,mjs,cjs,jsx}",
      "src/Layout.jsx",
    ],
    ignores: ["src/lib/**/*", "src/components/ui/**/*"],
    ...pluginJs.configs.recommended,
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "unused-imports": pluginUnusedImports,
    },
    rules: {
      "no-unused-vars": "off",
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "error",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/no-unknown-property": [
        "error",
        { ignore: ["cmdk-input-wrapper", "toast-close"] },
      ],
      "react-hooks/rules-of-hooks": "error",
    },
  },
  {
    // Le funzioni e i moduli condivisi del backend. Non erano coperti da niente,
    // e il 19/09/2026 una variabile rinominata a meta' - "viaggi" diventata
    // "viaggiDaPagare" - e' arrivata in produzione e ha rotto la fatturazione
    // passiva della rete: la funzione rispondeva "viaggi is not defined" e la
    // scheda restava vuota. no-undef qui sotto lo avrebbe fermato.
    files: ["base44/**/*.ts"],
    ...pluginJs.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.browser,
        Deno: "readonly",
        process: "readonly",
        Buffer: "readonly",
      },
      // Qualche modulo del backend usa davvero la sintassi TypeScript
      // (annotazioni, interface): col parser di serie non si leggerebbe, e
      // resterebbe fuori dal controllo proprio come prima.
      parser: parserTs,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_" }],
      "no-empty": "off",
    },
  },
];
