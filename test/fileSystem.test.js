import { test } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import { 
  shouldAnalyzeFile, 
  shouldIgnoreDir,
  determineEntryPoint 
} from '../src/fileSystem.js';

// Create a temporary test directory
test.before(async () => {
  // Setup: Create temp directory with mock package.json
  if (!fs.existsSync('./test-tmp')) {
    fs.mkdirSync('./test-tmp');
    fs.writeFileSync('./test-tmp/package.json', JSON.stringify({
      main: './src/main.js',
      exports: {
        '.': './src/index.js'
      }
    }));
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

// Clean up after tests
test.after(() => {
  // Optional cleanup: Remove temp directory
  fs.rmSync('./test-tmp', { recursive: true, force: true });
});
