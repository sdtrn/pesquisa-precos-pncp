import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Custom loader to resolve "@/..." to "./src/..." and mock external export libs
register(
  `data:text/javascript,
  import { pathToFileURL } from 'node:url';
  import { resolve as pathResolve } from 'node:path';

  export async function resolve(specifier, context, nextResolve) {
    if (specifier === 'exceljs') {
      const mock = pathResolve(process.cwd(), 'tests', 'mocks', 'mock-exceljs.ts');
      return nextResolve(pathToFileURL(mock).href, context);
    }
    if (specifier === 'jspdf') {
      const mock = pathResolve(process.cwd(), 'tests', 'mocks', 'mock-jspdf.ts');
      return nextResolve(pathToFileURL(mock).href, context);
    }
    if (specifier === 'jspdf-autotable') {
      const mock = pathResolve(process.cwd(), 'tests', 'mocks', 'mock-jspdf-autotable.ts');
      return nextResolve(pathToFileURL(mock).href, context);
    }
    if (specifier === 'vitest') {
      const mock = pathResolve(process.cwd(), 'tests', 'mocks', 'mock-vitest.ts');
      return nextResolve(pathToFileURL(mock).href, context);
    }

    if (specifier.startsWith('@/')) {
      const rel = specifier.slice(2);
      let target = pathResolve(process.cwd(), 'src', rel);
      if (!target.endsWith('.ts') && !target.endsWith('.tsx') && !target.endsWith('.json') && !target.endsWith('.js')) {
        target += '.ts';
      }
      return nextResolve(pathToFileURL(target).href, context);
    }
    return nextResolve(specifier, context);
  }

  export async function load(url, context, nextLoad) {
    if (url.endsWith('.json')) {
      return nextLoad(url, { ...context, importAttributes: { ...context.importAttributes, type: 'json' } });
    }
    return nextLoad(url, context);
  }
`,
  pathToFileURL("./")
);
