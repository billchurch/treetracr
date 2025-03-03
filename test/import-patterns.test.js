import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { getImportsFromFile, buildDependencyMaps, moduleDependencies } from '../src/analyzer.js';

// Setup test files
test.before(() => {
  if (!fs.existsSync('./test-imports')) {
    fs.mkdirSync('./test-imports', { recursive: true });
    
    // Create target modules
    fs.writeFileSync('./test-imports/target.js', '// Target module');
    
    // Create a file with various import patterns
    fs.writeFileSync('./test-imports/all-patterns.js', `
      // ES module imports
      import defaultExport from './target';
      import { namedExport } from './target';
      import * as namespace from './target';
      import './target';
      
      // Dynamic imports
      import('./target').then(module => console.log(module));
      
      // CommonJS requires
      const cjs1 = require('./target');
      const { destructured } = require('./target');
      let cjsLet = require('./target');
      var cjsVar = require('./target');
      
      // Bare require
      require('./target');
      
      // Nested require
      someFunction(require('./target'));
      
      // Multiple requires on one line
      const [a, b] = [require('./target'), require('./target')];
      
      // Re-exports
      export { something } from './target';
      export * from './target';
    `);
  }
});

test('getImportsFromFile should detect all import patterns', async () => {
  const filePath = path.resolve('./test-imports/all-patterns.js');
  const imports = await getImportsFromFile(filePath);
  
  // All imports reference the same target file
  const targetPath = path.resolve('./test-imports/target.js');
  
  // Count unique imports (should be 1 since all imports reference the same file)
  const uniqueTargets = new Set(imports.map(imp => path.normalize(imp)));
  assert.strictEqual(uniqueTargets.size, 1);
  
  // Verify the target path is included
  assert.ok(uniqueTargets.has(path.normalize(targetPath)));
});

test('buildDependencyMaps should correctly map all import patterns', async () => {
  // Clear maps before test
  moduleDependencies.clear();
  
  const files = [
    path.resolve('./test-imports/all-patterns.js'),
    path.resolve('./test-imports/target.js')
  ];
  
  await buildDependencyMaps(files);
  
  // Check that all-patterns.js has target.js as a dependency
  const allPatternsDeps = moduleDependencies.get(path.resolve('./test-imports/all-patterns.js'));
  const targetPath = path.normalize(path.resolve('./test-imports/target.js'));
  
  assert.ok(allPatternsDeps.some(dep => path.normalize(dep) === targetPath));
});

// Cleanup
test.after(() => {
  fs.rmSync('./test-imports', { recursive: true, force: true });
});
