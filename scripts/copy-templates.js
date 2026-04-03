#!/usr/bin/env node
import { cpSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';

const sourceDir = resolve('./src/scaffold/templates');
const destDir = resolve('./dist/scaffold/templates');

mkdirSync(destDir, { recursive: true });

/**
 * Recursively copy files from source to dest, filtering out compiled artifacts.
 * Skip .js.map, .d.ts.map, .d.ts files entirely.
 * Skip .js files only if a same-name .ts file exists in the same directory.
 */
function copyRecursive(src, dest) {
  const entries = readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    
    if (entry.isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      // Skip .js.map and .d.ts.map files
      if (entry.name.endsWith('.js.map') || entry.name.endsWith('.d.ts.map')) {
        continue;
      }
      
      // Skip .d.ts files
      if (entry.name.endsWith('.d.ts')) {
        continue;
      }
      
      // For .js files, skip only if a same-name .ts exists in the same directory
      if (entry.name.endsWith('.js')) {
        const tsName = entry.name.replace(/\.js$/, '.ts');
        const tsPath = join(src, tsName);
        try {
          statSync(tsPath);
          // .ts file exists, skip this .js (it's a compiled artifact)
          continue;
        } catch {
          // .ts file does NOT exist, keep this .js (it's intentional like cucumber.js)
        }
      }
      
      // Copy the file
      cpSync(srcPath, destPath, { force: true });
    }
  }
}

copyRecursive(sourceDir, destDir);

console.log('✓ Templates copied to dist/scaffold/templates');
