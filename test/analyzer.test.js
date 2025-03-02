import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { 
  normalizePath, 
  getImportsFromFile,
  isTestFile,
  buildDependencyMaps,
  traceDependenciesFromEntry,
  moduleDependencies,
  moduleReferences
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
    
    // Create circular dependency files
    fs.mkdirSync('./test-files/circular', { recursive: true });
    fs.writeFileSync('./test-files/circular/a.js', `import './circular/b.js';`);
    fs.writeFileSync('./test-files/circular/b.js', `import './circular/c.js';`);
    fs.writeFileSync('./test-files/circular/c.js', `import './circular/a.js';`);
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

test('buildDependencyMaps should create correct dependency and reference maps', async () => {
  // Clear maps before test
  moduleDependencies.clear();
  moduleReferences.clear();
  
  const files = [
    path.resolve('./test-files/index.js'),
    path.resolve('./test-files/utils.js'),
    path.resolve('./test-files/components/Bar.js'),
    path.resolve('./test-files/services/baz.js')
  ];
  
  await buildDependencyMaps(files);
  
  // Check moduleDependencies
  const indexDeps = moduleDependencies.get(path.resolve('./test-files/index.js'));
  assert.strictEqual(indexDeps.length, 3);
  
  // Check moduleReferences - utils.js should be referenced by index.js
  const utilsRefs = moduleReferences.get(path.resolve('./test-files/utils.js'));
  assert.ok(utilsRefs.includes(path.resolve('./test-files/index.js')));
  
  // Other files should have empty dependencies
  assert.strictEqual(moduleDependencies.get(path.resolve('./test-files/utils.js')).length, 0);
  assert.strictEqual(moduleDependencies.get(path.resolve('./test-files/components/Bar.js')).length, 0);
  assert.strictEqual(moduleDependencies.get(path.resolve('./test-files/services/baz.js')).length, 0);
});

test('traceDependenciesFromEntry should trace dependencies correctly', async () => {
  // Setup dependency maps for a clear test
  moduleDependencies.clear();
  moduleReferences.clear();
  
  const indexPath = path.resolve('./test-files/index.js');
  const utilsPath = path.resolve('./test-files/utils.js');
  const barPath = path.resolve('./test-files/components/Bar.js');
  const bazPath = path.resolve('./test-files/services/baz.js');
  
  // Manually set up dependencies
  moduleDependencies.set(indexPath, [utilsPath, barPath, bazPath]);
  moduleDependencies.set(utilsPath, []);
  moduleDependencies.set(barPath, []);
  moduleDependencies.set(bazPath, []);
  
  moduleReferences.set(utilsPath, [indexPath]);
  moduleReferences.set(barPath, [indexPath]);
  moduleReferences.set(bazPath, [indexPath]);
  
  // Trace from entry point
  const visited = await traceDependenciesFromEntry(indexPath, './test-files');
  
  // Should contain index and all dependencies
  assert.strictEqual(visited.size, 4);
  assert.ok(visited.has(path.normalize(indexPath)));
  assert.ok(visited.has(path.normalize(utilsPath)));
  assert.ok(visited.has(path.normalize(barPath)));
  assert.ok(visited.has(path.normalize(bazPath)));
});

test('traceDependenciesFromEntry should handle circular dependencies', async () => {
  // Setup dependency maps for circular references
  moduleDependencies.clear();
  moduleReferences.clear();
  
  const aPath = path.resolve('./test-files/circular/a.js');
  const bPath = path.resolve('./test-files/circular/b.js');
  const cPath = path.resolve('./test-files/circular/c.js');
  
  // Manually set up circular dependencies
  moduleDependencies.set(aPath, [bPath]);
  moduleDependencies.set(bPath, [cPath]);
  moduleDependencies.set(cPath, [aPath]);
  
  moduleReferences.set(aPath, [cPath]);
  moduleReferences.set(bPath, [aPath]);
  moduleReferences.set(cPath, [bPath]);
  
  // Trace from entry point
  const visited = await traceDependenciesFromEntry(aPath, './test-files');
  
  // Should contain all three files despite circular references
  assert.strictEqual(visited.size, 3);
  assert.ok(visited.has(path.normalize(aPath)));
  assert.ok(visited.has(path.normalize(bPath)));
  assert.ok(visited.has(path.normalize(cPath)));
});

test('traceDependenciesFromEntry should handle non-existent files', async () => {
  const nonExistentPath = path.resolve('./test-files/non-existent.js');
  
  // Trace from non-existent entry point
  const visited = await traceDependenciesFromEntry(nonExistentPath, './test-files');
  
  // Should return empty set
  assert.strictEqual(visited.size, 0);
});

// Cleanup
test.after(() => {
  fs.rmSync('./test-files', { recursive: true, force: true });
});
