#!/usr/bin/env node
import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const sourceDir = resolve('./src/scaffold/templates');
const destDir = resolve('./dist/scaffold/templates');

mkdirSync(destDir, { recursive: true });
cpSync(sourceDir, destDir, { recursive: true });

console.log('✓ Templates copied to dist/scaffold/templates');
