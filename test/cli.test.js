import { test } from 'node:test';
import assert from 'node:assert';
import { parseCommandLine } from '../src/cli.js';

// Save original argv and restore after tests
const originalArgv = process.argv;

test('parseCommandLine should handle empty arguments', () => {
  process.argv = ['node', 'index.js'];
  const result = parseCommandLine();
  assert.deepStrictEqual(result, {
    help: false,
    testDir: null,
    sourceDir: '.',
    entryPoint: null,
    remainingArgs: []
  });
});

test('parseCommandLine should handle help flag', () => {
  process.argv = ['node', 'index.js', '--help'];
  const result = parseCommandLine();
  assert.strictEqual(result.help, true);
  
  process.argv = ['node', 'index.js', '-h'];
  const result2 = parseCommandLine();
  assert.strictEqual(result2.help, true);
});

test('parseCommandLine should handle test directory flag', () => {
  process.argv = ['node', 'index.js', '--test-dir', './tests'];
  const result = parseCommandLine();
  assert.strictEqual(result.testDir, './tests');
  
  process.argv = ['node', 'index.js', '-t', './other-tests'];
  const result2 = parseCommandLine();
  assert.strictEqual(result2.testDir, './other-tests');
});

test('parseCommandLine should handle positional arguments', () => {
  process.argv = ['node', 'index.js', './my-project', './src/index.js', 'extra-arg'];
  const result = parseCommandLine();
  assert.strictEqual(result.sourceDir, './my-project');
  assert.strictEqual(result.entryPoint, './src/index.js');
  assert.deepStrictEqual(result.remainingArgs, ['extra-arg']);
});

// Restore original argv after tests
test.after(() => {
  process.argv = originalArgv;
});
