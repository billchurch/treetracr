import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { 
  moduleDependencies,
  checkUnusedPackageDependencies,
  unusedPackageDependencies
} from '../src/analyzer.js';

// Setup test files
test.before(() => {
  // Create test directories
  if (!fs.existsSync('./test-pkg-deps')) {
    fs.mkdirSync('./test-pkg-deps', { recursive: true });

    // Create a package.json with dependencies
    fs.writeFileSync('./test-pkg-deps/package.json', JSON.stringify({
      "name": "test-pkg",
      "version": "1.0.0",
      "dependencies": {
        "used-dep": "^1.0.0",
        "unused-dep": "^2.0.0",
        "another-used-dep": "^3.0.0",
        "yet-another-unused-dep": "^4.0.0"
      }
    }));

    // Create a source file that uses some of the dependencies
    fs.writeFileSync('./test-pkg-deps/index.js', `
      import { something } from 'used-dep';
      import AnotherThing from 'another-used-dep';
    `);
  }
});

test('checkUnusedPackageDependencies should identify unused dependencies', async () => {
  // Clear maps before test
  moduleDependencies.clear();
  unusedPackageDependencies.clear();
  
  // Add the test file to the dependency map
  const indexPath = path.resolve('./test-pkg-deps/index.js');
  moduleDependencies.set(indexPath, []);
  
  // Run the check and store the result
  const testDir = path.resolve('./test-pkg-deps');
  const unused = await checkUnusedPackageDependencies(testDir);
  
  // Should identify two unused dependencies
  assert.strictEqual(unused.size, 2);
  assert.ok(unused.has('unused-dep'));
  assert.ok(unused.has('yet-another-unused-dep'));
  
  // Should not include used dependencies
  assert.ok(!unused.has('used-dep'));
  assert.ok(!unused.has('another-used-dep'));
});

test('checkUnusedPackageDependencies should handle missing package.json', async () => {
  // Create temp directory with no package.json
  const tempDir = './test-pkg-deps/empty-dir';
  fs.mkdirSync(tempDir, { recursive: true });
  
  // Run the check
  unusedPackageDependencies.clear();
  await checkUnusedPackageDependencies(tempDir);
  
  // Should return empty set
  assert.strictEqual(unusedPackageDependencies.size, 0);
});

test('checkUnusedPackageDependencies should handle package.json with no dependencies', async () => {
  // Create temp directory with package.json but no dependencies
  const tempDir = './test-pkg-deps/no-deps-dir';
  fs.mkdirSync(tempDir, { recursive: true });
  
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
    "name": "no-deps",
    "version": "1.0.0"
  }));
  
  // Run the check
  unusedPackageDependencies.clear();
  await checkUnusedPackageDependencies(tempDir);
  
  // Should return empty set
  assert.strictEqual(unusedPackageDependencies.size, 0);
});

// Cleanup
test.after(() => {
  fs.rmSync('./test-pkg-deps', { recursive: true, force: true });
});