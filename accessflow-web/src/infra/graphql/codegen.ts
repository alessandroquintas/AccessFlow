import { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "../accessflow-api/src/graphql/schema.gql",
  documents: ["src/**/*.{ts,tsx}", "!src/infra/graphql/generated/**"],
  ignoreNoDocuments: true,
  generates: {
    "./src/infra/graphql/generated/": {
      preset: "client",
      presetConfig: {
        fragmentMasking: false, // Sem "fragment masking" os dados chegam do jeito que a query pediu;
      },
      config: {
        documentMode: "string", // Documentos como string tipada: dá para mandar por fetch, sem cliente GraphQL.
        enumsAsTypes: true, // Enums do schema viram uniões de string ("OWNER" | "MEMBER"), sem objeto em runtime.
        useTypeImports: true,
        scalars: { DateTime: "string" }, // O único scalar customizado da API.
      },
    },
  },
};

export default config;
