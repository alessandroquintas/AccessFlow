import { readdirSync } from "node:fs";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Cada pasta de src/modules é um módulo; a lista se atualiza sozinha.
const modules = readdirSync(new URL("./src/modules", import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

/**
 * Fronteiras da arquitetura (resolvidas pelo caminho real, então pegam tanto
 * `@/modules/x/hooks/...` quanto `../../x/hooks/...`):
 * - de fora de um módulo, só containers/ e schemas/ (sem barrel index.ts);
 * - shared/ não importa de modules/.
 */
const moduleBoundaries = modules.map((name) => ({
  target: [
    `./src/modules/!(${name})/**/*`,
    "./src/app/**/*",
    "./src/presentation/**/*",
    "./src/shared/**/*",
    "./src/infra/**/*",
    "./src/test/**/*",
  ],
  from: `./src/modules/${name}`,
  except: ["./containers", "./schemas"],
  message: `De fora do módulo "${name}", importe só de containers/ ou schemas/.`,
}));

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            ...moduleBoundaries,
            {
              target: "./src/shared",
              from: "./src/modules",
              message: "shared/ é genérico e não importa de modules/.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
