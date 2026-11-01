import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Custom loader to resolve "@/..." to "./src/..."
register(
  `data:text/javascript,
  import { pathToFileURL } from 'node:url';
  import { resolve as pathResolve } from 'node:path';
  export async function resolve(specifier, context, nextResolve) {
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
`,
  pathToFileURL("./")
);
