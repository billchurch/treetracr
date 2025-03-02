import { test } from 'node:test';
import assert from 'node:assert';
import { formatPath } from '../src/visualizer.js';

test('formatPath should generate relative paths', () => {
  const sourceDir = '/project';
  const filePath = '/project/src/components/Button.js';
  
  const formatted = formatPath(filePath, sourceDir);
  assert.strictEqual(formatted, 'src/components/Button.js');
});
