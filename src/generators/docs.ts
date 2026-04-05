/**
 * @module generators/docs
 * @description Generates API documentation from JSDoc comments using TypeDoc's
 * programmatic Node API. Reads optional `typedoc.json` from the project root
 * and merges sensible defaults from `bdd-workflow.config.ts`. Outputs markdown
 * files (via typedoc-plugin-markdown) or HTML to the configured output
 * directory. Does NOT invoke TypeDoc as a shell command — uses
 * Application.bootstrapWithPlugins so output can be tested and errors surfaced
 * clearly.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { BddWorkflowConfig } from '../config.js';

/**
 * Generate API documentation for the user's project using TypeDoc.
 *
 * For markdown output, uses `typedoc-plugin-markdown` via the TypeDoc 0.28+
 * outputs API (`app.generateOutputs`). For HTML output, uses the built-in
 * TypeDoc HTML renderer (`app.generateDocs`). Throws if TypeDoc fails to parse
 * the project (e.g., missing entry point).
 *
 * @param config - Resolved bdd-workflow configuration
 * @throws {Error} If the entry point does not exist or TypeDoc fails to parse the project
 */
export async function generateDocs(config: BddWorkflowConfig): Promise<void> {
  const entryPoint = join(process.cwd(), 'src', 'index.ts');

  if (!existsSync(entryPoint)) {
    throw new Error(
      `[bdd-workflow] docs: entry point not found: ${entryPoint}\n` +
        'Ensure src/index.ts exists in the project root before running bdd-workflow docs.'
    );
  }

  // Dynamic import so TypeDoc is only loaded when the docs command is actually run.
  // This avoids startup cost for other subcommands.
  const { Application, TSConfigReader, TypeDocReader } = await import('typedoc');

  const isMarkdown = config.docs.format !== 'html';

  // For markdown: include the plugin so it registers the `markdown` output type.
  // For HTML: no extra plugin needed.
  const plugins = isMarkdown ? ['typedoc-plugin-markdown'] : [];

  // TypeDoc 0.28 + typedoc-plugin-markdown uses `markdown` as the output dir key
  // (registered by the plugin), while HTML still uses `out`.
  const bootstrapOptions: Record<string, unknown> = {
    entryPoints: [entryPoint],
    tsconfig: join(process.cwd(), 'tsconfig.json'),
    plugin: plugins,
    readme: 'none',
    excludePrivate: true,
    excludeInternal: true,
  };

  if (isMarkdown) {
    // `markdown` option is registered by typedoc-plugin-markdown and maps to
    // the output directory for the markdown renderer.
    bootstrapOptions['markdown'] = config.docs.outputDir;
  } else {
    bootstrapOptions['out'] = config.docs.outputDir;
  }

  const app = await Application.bootstrapWithPlugins(bootstrapOptions, [
    new TSConfigReader(),
    new TypeDocReader(),
  ]);

  const project = await app.convert();
  if (!project) {
    throw new Error('[bdd-workflow] docs: TypeDoc failed to parse the project.');
  }

  if (isMarkdown) {
    // generateOutputs uses the plugin-registered markdown output type
    await app.generateOutputs(project);
  } else {
    await app.generateDocs(project, config.docs.outputDir);
  }
}
