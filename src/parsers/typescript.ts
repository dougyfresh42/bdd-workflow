/**
 * @module parsers/typescript
 * @description Extracts exported function and class signatures from
 * TypeScript source files using the TypeScript compiler API (ts.Program +
 * TypeChecker). Returns human-readable signature strings suitable for the
 * Public API section of CONTEXT.md. Does NOT produce HTML or markdown links —
 * plain text signatures only.
 */

import ts from 'typescript';
import { glob } from 'glob';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { BddWorkflowConfig } from '../config.js';

/** Exported API entries for a single source file. */
export interface ApiEntry {
  filePath: string;
  signatures: string[];
}

/**
 * Extract exported symbol signatures from TypeScript source files.
 *
 * Loads tsconfig.json from `process.cwd()`, creates a ts.Program, and for
 * each source file matching the configured include patterns extracts all
 * exported declarations and formats them as signature strings.
 *
 * @param config - Resolved bdd-workflow configuration
 * @returns Array of ApiEntry objects; files with no exports are omitted
 */
export async function extractPublicApi(config: BddWorkflowConfig): Promise<ApiEntry[]> {
  const cwd = process.cwd();
  const tsConfigPath = join(cwd, 'tsconfig.json');

  let rootNames: string[];
  let compilerOptions: ts.CompilerOptions;

  if (existsSync(tsConfigPath)) {
    const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
    if (configFile.error) {
      console.warn(`[bdd-workflow] Warning: could not read tsconfig.json: ${configFile.error.messageText}`);
    }
    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config ?? {},
      ts.sys,
      cwd
    );
    compilerOptions = parsedConfig.options;
    rootNames = parsedConfig.fileNames;
  } else {
    compilerOptions = { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.NodeNext };
    rootNames = [];
  }

  // Collect target files from config include patterns
  const targetFiles: string[] = [];
  for (const pattern of config.context.include) {
    const matches = await glob(pattern, {
      ignore: [...config.context.exclude, '**/*.d.ts'],
      cwd,
    });
    const tsMatches = matches.filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'));
    targetFiles.push(...tsMatches.map(f => join(cwd, f)));
  }

  const uniqueTargets = [...new Set(targetFiles)].sort();

  if (uniqueTargets.length === 0) return [];

  // Merge target files into root names so the program can resolve types
  const allRootNames = [...new Set([...rootNames, ...uniqueTargets])];

  const program = ts.createProgram(allRootNames, {
    ...compilerOptions,
    skipLibCheck: true,
    noEmit: true,
  });
  const checker = program.getTypeChecker();

  const results: ApiEntry[] = [];

  for (const filePath of uniqueTargets) {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) continue;

    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) continue;

    const exports = checker.getExportsOfModule(moduleSymbol);
    if (exports.length === 0) continue;

    const signatures: string[] = [];
    for (const symbol of exports) {
      const sig = formatSignature(checker, symbol);
      if (sig) signatures.push(sig);
    }

    if (signatures.length > 0) {
      // Use relative path from cwd for output
      const relativePath = filePath.startsWith(cwd + '/')
        ? filePath.slice(cwd.length + 1)
        : filePath;
      results.push({ filePath: relativePath, signatures });
    }
  }

  return results;
}

/**
 * Format a TypeScript symbol as a human-readable signature string.
 *
 * @param checker - TypeScript TypeChecker instance
 * @param symbol - The exported symbol to format
 * @returns Signature string, or null if the symbol should be skipped
 */
function formatSignature(checker: ts.TypeChecker, symbol: ts.Symbol): string | null {
  const decl = symbol.declarations?.[0];
  if (!decl) return symbol.name;

  // Function declarations
  if (ts.isFunctionDeclaration(decl)) {
    const sig = checker.getSignatureFromDeclaration(decl);
    if (sig) {
      return `${symbol.name}${checker.signatureToString(sig)}`;
    }
  }

  // Class declarations
  if (ts.isClassDeclaration(decl)) {
    return `class ${symbol.name}`;
  }

  // Interface declarations
  if (ts.isInterfaceDeclaration(decl)) {
    return `interface ${symbol.name}`;
  }

  // Type alias declarations
  if (ts.isTypeAliasDeclaration(decl)) {
    return `type ${symbol.name}`;
  }

  // Variable declarations (const, let, var)
  if (ts.isVariableDeclaration(decl)) {
    const type = checker.getTypeOfSymbolAtLocation(symbol, decl);
    return `${symbol.name}: ${checker.typeToString(type)}`;
  }

  // Export specifiers (re-exports)
  if (ts.isExportSpecifier(decl)) {
    const type = checker.getTypeOfSymbolAtLocation(symbol, decl);
    const typeStr = checker.typeToString(type);
    // Skip re-exported types that are just "typeof X" — too noisy
    if (typeStr.startsWith('typeof ')) return null;
    return `${symbol.name}: ${typeStr}`;
  }

  // Fallback: use typeToString
  try {
    const type = checker.getTypeOfSymbolAtLocation(symbol, decl);
    return `${symbol.name}: ${checker.typeToString(type)}`;
  } catch {
    return symbol.name;
  }
}
