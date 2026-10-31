import { defineConfig } from "vitest/config";
import path from "path";
import fs from "fs";

const localDeps = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, "PesquisaPrecosPNCP_Vercel_deps", "node_modules")
  : "";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: [
      { find: /^@\/(.*)/, replacement: `${path.resolve(__dirname, "./src")}/$1` },
      ...(localDeps && fs.existsSync(localDeps)
        ? [
            { find: "exceljs", replacement: path.join(localDeps, "exceljs/index.js") },
            { find: "jspdf", replacement: path.join(localDeps, "jspdf/dist/jspdf.node.min.js") },
            { find: "jspdf-autotable", replacement: path.join(localDeps, "jspdf-autotable/dist/jspdf.plugin.autotable.js") },
          ]
        : []),
    ],
  },
});
