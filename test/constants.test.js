import { test } from 'node:test';
import assert from 'node:assert';
import { 
  IMPORT_PATTERNS, 
  TEST_PATTERNS, 
  JS_EXTENSIONS, 
  IGNORE_DIRS 
} from '../src/constants.js';

test('IMPORT_PATTERNS should match various import styles', () => {
  const testCases = [
    { code: 'import foo from "./bar"', match: './bar' },
    { code: 'import { foo } from "./bar"', match: './bar' },
    { code: 'const foo = require("./bar")', match: './bar' },
    { code: 'const foo = await import("./bar")', match: './bar' }
  ];

  testCases.forEach(({ code, match }) => {
    let found = false;
    for (const pattern of IMPORT_PATTERNS) {
      pattern.lastIndex = 0; // Reset RegExp state
      const result = pattern.exec(code);
      if (result && result[1] === match) {
        found = true;
        break;
      }
    }
    assert.ok(found, `Pattern should match: ${code}`);
  });
});

test('TEST_PATTERNS should identify test files', () => {
  const testPaths = [
    '/project/src/foo.test.js',
    '/project/src/foo.spec.js',
    '/project/__tests__/foo.js',
    '/project/test/foo.js'
  ];
  
  testPaths.forEach(path => {
    assert.ok(
      TEST_PATTERNS.some(pattern => pattern.test(path)),
      `Should identify test file: ${path}`
    );
  });
});

test('JS_EXTENSIONS should include common JavaScript and TypeScript extensions', () => {
  const expectedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.jest'];
  assert.deepStrictEqual(JS_EXTENSIONS, expectedExtensions);
});
