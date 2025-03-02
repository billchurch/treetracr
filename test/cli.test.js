import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCommandLine } from '../src/cli.js';

// Save original argv and restore after tests
const originalArgv = process.argv;

// Test for empty arguments
test('parseCommandLine should handle empty arguments', () => {
  process.argv = ['node', 'index.js'];
  const result = parseCommandLine();
  assert.deepStrictEqual(result, {
    help: false,
    testDir: null,
    sourceDir: '.',
    entryPoint: null,
    ci: false,
    failOnCircular: false,
    failOnUnused: false,
    failOnUnusedPackageDeps: false,
    remainingArgs: []
  });
});

// Test for help flag
test('parseCommandLine should handle help flag', () => {
  process.argv = ['node', 'index.js', '--help'];
  const result = parseCommandLine();
  assert.strictEqual(result.help, true);
  
  process.argv = ['node', 'index.js', '-h'];
  const result2 = parseCommandLine();
  assert.strictEqual(result2.help, true);
});

// Test for test directory flag
test('parseCommandLine should handle test directory flag', () => {
  process.argv = ['node', 'index.js', '--test-dir', './tests'];
  const result = parseCommandLine();
  assert.strictEqual(result.testDir, './tests');
  
  process.argv = ['node', 'index.js', '-t', './other-tests'];
  const result2 = parseCommandLine();
  assert.strictEqual(result2.testDir, './other-tests');
});

// Test for positional arguments
test('parseCommandLine should handle positional arguments', () => {
  process.argv = ['node', 'index.js', './my-project', './src/index.js', 'extra-arg'];
  const result = parseCommandLine();
  assert.strictEqual(result.sourceDir, './my-project');
  assert.strictEqual(result.entryPoint, './src/index.js');
  assert.deepStrictEqual(result.remainingArgs, ['extra-arg']);
});

// Test for CI mode flag
test('parseCommandLine should handle CI mode flag', () => {
  process.argv = ['node', 'index.js', '--ci'];
  const result = parseCommandLine();
  assert.strictEqual(result.ci, true);
  assert.strictEqual(result.failOnCircular, true);
  assert.strictEqual(result.failOnUnused, true);
  assert.strictEqual(result.failOnUnusedPackageDeps, true);
});

// Test for fail-on-circular flag
test('parseCommandLine should handle fail-on-circular flag', () => {
  process.argv = ['node', 'index.js', '--fail-on-circular'];
  const result = parseCommandLine();
  assert.strictEqual(result.ci, false);
  assert.strictEqual(result.failOnCircular, true);
  assert.strictEqual(result.failOnUnused, false);
});

// Test for fail-on-unused flag
test('parseCommandLine should handle fail-on-unused flag', () => {
  process.argv = ['node', 'index.js', '--fail-on-unused'];
  const result = parseCommandLine();
  assert.strictEqual(result.ci, false);
  assert.strictEqual(result.failOnCircular, false);
  assert.strictEqual(result.failOnUnused, true);
});

// Test for fail-on-unused-deps flag
test('parseCommandLine should handle fail-on-unused-deps flag', () => {
  process.argv = ['node', 'index.js', '--fail-on-unused-deps'];
  const result = parseCommandLine();
  assert.strictEqual(result.ci, false);
  assert.strictEqual(result.failOnCircular, false);
  assert.strictEqual(result.failOnUnused, false);
  assert.strictEqual(result.failOnUnusedPackageDeps, true);
});

// Test for combined CI flags
test('parseCommandLine should handle combined CI flags', () => {
  process.argv = ['node', 'index.js', '--ci', '--fail-on-circular', '--fail-on-unused', '--fail-on-unused-deps'];
  const result = parseCommandLine();
  assert.strictEqual(result.ci, true);
  assert.strictEqual(result.failOnCircular, true);
  assert.strictEqual(result.failOnUnused, true);
  assert.strictEqual(result.failOnUnusedPackageDeps, true);
});

// Restore original argv after tests
test.after(() => {
  process.argv = originalArgv;
});
