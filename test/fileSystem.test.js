import { test } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import { 
  shouldAnalyzeFile, 
  shouldIgnoreDir,
  determineEntryPoint,
  scanDirectory
} from '../src/fileSystem.js';

// Create a temporary test directory
test.before(async () => {
  // Setup: Create temp directory with mock package.json and structure
  if (!fs.existsSync('./test-tmp')) {
    // Create root directory
    fs.mkdirSync('./test-tmp');
    
    // Create package.json
    fs.writeFileSync('./test-tmp/package.json', JSON.stringify({
      main: './src/main.js',
      exports: {
        '.': './src/index.js'
      }
    }));
    
    // Create source structure
    fs.mkdirSync('./test-tmp/src', { recursive: true });
    fs.mkdirSync('./test-tmp/src/components', { recursive: true });
    fs.mkdirSync('./test-tmp/src/utils', { recursive: true });
    fs.mkdirSync('./test-tmp/test', { recursive: true });
    fs.mkdirSync('./test-tmp/dist', { recursive: true });
    fs.mkdirSync('./test-tmp/node_modules', { recursive: true });
    
    // Create JS files
    fs.writeFileSync('./test-tmp/src/index.js', '// index file');
    fs.writeFileSync('./test-tmp/src/main.js', '// main file');
    fs.writeFileSync('./test-tmp/src/components/Button.js', '// button component');
    fs.writeFileSync('./test-tmp/src/components/Form.jsx', '// form component');
    fs.writeFileSync('./test-tmp/src/utils/helpers.js', '// helper functions');
    fs.writeFileSync('./test-tmp/src/utils/constants.ts', '// constants');
    
    // Create test files
    fs.writeFileSync('./test-tmp/test/Button.test.js', '// button tests');
    fs.writeFileSync('./test-tmp/test/helpers.test.js', '// helper tests');
    
    // Create non-JS files
    fs.writeFileSync('./test-tmp/src/styles.css', '/* CSS styles */');
    fs.writeFileSync('./test-tmp/README.md', '# Test Project');
    
    // Create files in ignored directories
    fs.writeFileSync('./test-tmp/dist/bundle.js', '// bundled code');
    fs.writeFileSync('./test-tmp/node_modules/module.js', '// module code');
  }
});

test('shouldAnalyzeFile should return true for JS/TS files', () => {
  assert.strictEqual(shouldAnalyzeFile('file.js'), true);
  assert.strictEqual(shouldAnalyzeFile('file.jsx'), true);
  assert.strictEqual(shouldAnalyzeFile('file.ts'), true);
  assert.strictEqual(shouldAnalyzeFile('file.tsx'), true);
  assert.strictEqual(shouldAnalyzeFile('file.mjs'), true);
  assert.strictEqual(shouldAnalyzeFile('file.css'), false);
  assert.strictEqual(shouldAnalyzeFile('file.html'), false);
});

test('shouldIgnoreDir should return true for specified directories', () => {
  assert.strictEqual(shouldIgnoreDir('/path/to/node_modules'), true);
  assert.strictEqual(shouldIgnoreDir('/path/to/dist'), true);
  assert.strictEqual(shouldIgnoreDir('/path/to/src'), false);
  assert.strictEqual(shouldIgnoreDir('/path/to/components'), false);
});

test('determineEntryPoint should use user-provided entry point', async () => {
  const entryPoint = await determineEntryPoint('./src', './custom.js');
  assert.strictEqual(entryPoint, './custom.js');
});

test('determineEntryPoint should read from package.json', async () => {
  const entryPoint = await determineEntryPoint('./test-tmp');
  assert.strictEqual(entryPoint, './src/main.js');
});

test('scanDirectory should find all JS/TS files except in ignored directories', async () => {
  const files = await scanDirectory('./test-tmp');
  
  // Should find all JS/TS files
  assert.ok(files.length > 0);
  
  // Convert paths to relative for easier assertions
  const relativePaths = files.map(file => 
    path.relative('./test-tmp', file).replace(/\\/g, '/')
  );
  
  // Should include source files
  assert.ok(relativePaths.includes('src/index.js'));
  assert.ok(relativePaths.includes('src/main.js'));
  assert.ok(relativePaths.includes('src/components/Button.js'));
  assert.ok(relativePaths.includes('src/components/Form.jsx'));
  assert.ok(relativePaths.includes('src/utils/helpers.js'));
  assert.ok(relativePaths.includes('src/utils/constants.ts'));
  
  // Should include test files
  assert.ok(relativePaths.includes('test/Button.test.js'));
  assert.ok(relativePaths.includes('test/helpers.test.js'));
  
  // Should not include non-JS/TS files
  assert.ok(!relativePaths.includes('src/styles.css'));
  assert.ok(!relativePaths.includes('README.md'));
  
  // Should not include files from ignored directories
  assert.ok(!relativePaths.includes('dist/bundle.js'));
  assert.ok(!relativePaths.includes('node_modules/module.js'));
});

test('scanDirectory should handle non-existent directories gracefully', async () => {
  // Should not throw an error for non-existent directory
  const files = await scanDirectory('./non-existent-dir');
  assert.strictEqual(files.length, 0);
});

// Clean up after tests
test.after(() => {
  // Optional cleanup: Remove temp directory
  fs.rmSync('./test-tmp', { recursive: true, force: true });
});
