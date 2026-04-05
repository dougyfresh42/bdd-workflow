/**
 * @module parsers/jsdoc
 * @description Extracts file-level JSDoc comments from TypeScript source
 * files using the TypeScript compiler API. Targets the leading `/** ... *\/`
 * block comment of each file (the `@module` description). Does NOT use
 * regex — the TS compiler handles edge cases correctly. Files without a
 * file-level JSDoc comment are silently skipped.
 */

import ts from 'typescript';
import { readFile } from 'node:fs/promises';
import { glob } from 'glob';
import { BddWorkflowConfig } from '../config.js';

/** Summary of a single TypeScript source file's module-level documentation. */
export interface ModuleSummary {
  filePath: string;
  description: string;
}

/**
 * Extract file-level JSDoc descriptions from all TypeScript source files
 * matching the configured include patterns.
 *
 * @param config - Resolved bdd-workflow configuration
 * @returns Array of ModuleSummary objects; files without a file-level JSDoc
 *   comment are omitted
 */
export async function extractModuleSummaries(config: BddWorkflowConfig): Promise<ModuleSummary[]> {
  // Expand include patterns to only .ts files, excluding .d.ts
  const tsFiles: string[] = [];
  for (const pattern of config.context.include) {
    // Only match TypeScript source files
    const tsPattern = pattern.endsWith('/**/*') || pattern.endsWith('/**/*.ts')
      ? pattern.replace(/\/\*\*\/\*$/, '/**/*.ts')
      : pattern;

    // If the pattern doesn't reference .ts files, skip it
    if (!tsPattern.includes('.ts') && !tsPattern.includes('*')) continue;

    const matches = await glob(tsPattern, {
      ignore: [...config.context.exclude, '**/*.d.ts'],
    });
    tsFiles.push(...matches);
  }

  // If no ts-specific patterns matched, try the include patterns directly
  if (tsFiles.length === 0) {
    for (const pattern of config.context.include) {
      const matches = await glob(pattern, {
        ignore: [...config.context.exclude, '**/*.d.ts'],
      });
      const filtered = matches.filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'));
      tsFiles.push(...filtered);
    }
  }

  // Deduplicate and sort for deterministic output
  const uniqueFiles = [...new Set(tsFiles)].sort();

  const results: ModuleSummary[] = [];

  for (const filePath of uniqueFiles) {
    const content = await readFile(filePath, 'utf-8');
    const description = getFileJsDocDescription(filePath, content);
    if (description !== null) {
      results.push({ filePath, description });
    }
  }

  return results;
}

/**
 * Extract the file-level JSDoc description from TypeScript source text.
 *
 * Uses the TypeScript compiler API to locate the leading comment ranges of
 * the first statement, then finds the first `/** ... *\/` block and extracts
 * its description text (stripping tags like `@module`, `@param`, etc.).
 *
 * @param filePath - Path to the source file (used for SourceFile creation)
 * @param content - Raw source text
 * @returns The description string, or null if no file-level JSDoc block exists
 */
function getFileJsDocDescription(filePath: string, content: string): string | null {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.ESNext,
    /* setParentNodes */ true,
    ts.ScriptKind.TS
  );

  if (sourceFile.statements.length === 0) return null;

  const firstStatement = sourceFile.statements[0];
  const ranges = ts.getLeadingCommentRanges(sourceFile.text, firstStatement.getFullStart());
  if (!ranges || ranges.length === 0) return null;

  for (const range of ranges) {
    const text = sourceFile.text.slice(range.pos, range.end);
    if (text.startsWith('/**')) {
      return parseJsDocDescription(text);
    }
  }

  return null;
}

/**
 * Parse the description from a JSDoc block comment string.
 *
 * Strips the `/**`, `*\/`, and leading ` * ` prefixes from each line.
 * First attempts to extract a free-text description before the first `@` tag.
 * If none is found (e.g. the block starts immediately with `@module`), falls
 * back to extracting the value of the `@description` tag.
 *
 * @param jsDocText - Raw JSDoc block text (e.g. `/** ... *\/`)
 * @returns Cleaned description string, or empty string if none found
 */
function parseJsDocDescription(jsDocText: string): string {
  // Remove /** and */
  const inner = jsDocText
    .replace(/^\/\*\*/, '')
    .replace(/\*\/$/, '');

  const lines = inner.split('\n').map(line => {
    // Remove leading " * " or " *" prefix
    return line.replace(/^\s*\*\s?/, '').trim();
  });

  // Attempt 1: collect free-text description lines before the first @tag
  const descLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('@')) break;
    descLines.push(line);
  }

  const freeText = descLines.join(' ').replace(/\s+/g, ' ').trim();
  if (freeText) return freeText;

  // Attempt 2: extract the @description tag value (handles `@module … \n @description …`)
  const descTagMatch = jsDocText.match(/@description\s+([^\n@]+(?:\n(?!\s*\*\s*@)[^\n]*)*)/);
  if (descTagMatch) {
    // Clean up the matched text: remove leading " * " prefixes and collapse whitespace
    const raw = descTagMatch[1]
      .split('\n')
      .map(l => l.replace(/^\s*\*\s?/, '').trim())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (raw) return raw;
  }

  return '';
}
