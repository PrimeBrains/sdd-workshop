/**
 * ESLint flat config — design.md Boundary Commitments / Security Considerations の
 * 静的ガードを強制する:
 * - `@contracts/*` は `import type` 限定（ランタイム import 禁止）
 * - `dangerouslySetInnerHTML` の使用禁止（JSX 属性・オブジェクトプロパティの両形）
 * - `any` 型禁止（steering tech.md / tasks.md 1.1）
 */
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/", "node_modules/"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@contracts/*"],
              allowTypeImports: true,
              message:
                "@contracts/* は型契約専用です。`import type` のみ許可されます（design.md Allowed Dependencies）。",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            "dangerouslySetInnerHTML は禁止です（design.md Security Considerations）。",
        },
        {
          selector: "Property[key.name='dangerouslySetInnerHTML']",
          message:
            "dangerouslySetInnerHTML は禁止です（design.md Security Considerations）。",
        },
      ],
    },
  },
);
