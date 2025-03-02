import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { 
  normalizePath, 
  getImportsFromFile,
  isTestFile
} from '../src/analyzer.js';

// Setup test files
test.before(() => {
  // Create test directory with sample files
  if (!fs.existsSync('./test-files')) {
    fs.mkdirSync('./test-files', { recursive: true });
    
    // Create a file with imports
    fs.writeFileSync('./test-files/index.js', `
      import { foo } from './utils';
      import Bar from './components/Bar';
      const baz = require('./services/baz');
    `);
    
    // Create the imported files
    fs.mkdirSync('./test-files/components', { recursive: true });
    fs.mkdirSync('./test-files/services', { recursive: true });
    fs.writeFileSync('./test-files/utils.js', '// Utils module');
    fs.writeFileSync('./test-files/components/Bar.js', '// Bar component');
    fs.writeFileSync('./test-files/services/baz.js', '// Baz service');
  }
});

test('normalizePath should resolve relative imports correctly', () => {
  const basePath = path.resolve('./test-files/index.js');
  const normalizedPath = normalizePath(basePath, './utils');
  
  // normalizePath should convert to absolute path
  assert.ok(path.isAbsolute(normalizedPath));
  
  // Should resolve to the correct file
  assert.ok(normalizedPath.endsWith('utils.js') || normalizedPath.endsWith('utils'));
});

test('getImportsFromFile should extract all imports from a file', async () => {
  const filePath = path.resolve('./test-files/index.js');
  const imports = await getImportsFromFile(filePath);
  
  assert.strictEqual(imports.length, 3);
  
  // Check each import is found (note: full paths will vary by system)
  const importPaths = imports.map(p => path.basename(p));
  assert.ok(importPaths.includes('utils.js') || importPaths.includes('utils'));
  assert.ok(importPaths.includes('Bar.js') || importPaths.includes('Bar'));
  assert.ok(importPaths.includes('baz.js') || importPaths.includes('baz'));
});

test('isTestFile should identify test files correctly', () => {
  assert.strictEqual(isTestFile('/path/to/component.test.js'), true);
  assert.strictEqual(isTestFile('/path/to/component.spec.js'), true);
  assert.strictEqual(isTestFile('/path/to/__tests__/component.js'), true);
  assert.strictEqual(isTestFile('/path/to/test/component.js'), true);
  assert.strictEqual(isTestFile('/path/to/src/component.js'), false);
});

// Cleanup
test.after(() => {
  fs.rmSync('./test-files', { recursive: true, force: true });
});
