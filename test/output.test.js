import { test } from 'node:test';
import assert from 'node:assert';
import { output } from '../src/output.js';

// Mock console methods to capture output
test.beforeEach(() => {
  // Save original console methods
  global._originalConsole = {
    log: console.log,
    error: console.error
  };

  // Create output collectors
  global._consoleOutput = [];
  global._consoleError = [];

  // Mock console methods
  console.log = (...args) => {
    global._consoleOutput.push(args.join(' '));
  };
  
  console.error = (...args) => {
    global._consoleError.push(args.join(' '));
  };
});

// Restore original console methods after each test
test.afterEach(() => {
  console.log = global._originalConsole.log;
  console.error = global._originalConsole.error;
});

test('output.print should call console.log with the correct message', () => {
  const testMessage = 'Test message';
  output.print(testMessage);
  
  assert.strictEqual(global._consoleOutput.length, 1);
  assert.strictEqual(global._consoleOutput[0], testMessage);
});

test('output.info should call console.log with blue chalk formatting', () => {
  const testMessage = 'Info message';
  output.info(testMessage);
  
  assert.strictEqual(global._consoleOutput.length, 1);
  // We can't check the exact formatting (chalk), but we can verify the message content
  assert.ok(global._consoleOutput[0].includes(testMessage));
});

test('output.success should call console.log with green chalk formatting', () => {
  const testMessage = 'Success message';
  output.success(testMessage);
  
  assert.strictEqual(global._consoleOutput.length, 1);
  assert.ok(global._consoleOutput[0].includes(testMessage));
});

test('output.warning should call console.log with yellow chalk formatting', () => {
  const testMessage = 'Warning message';
  output.warning(testMessage);
  
  assert.strictEqual(global._consoleOutput.length, 1);
  assert.ok(global._consoleOutput[0].includes(testMessage));
});

test('output.error should call console.error with red formatting', () => {
  const testMessage = 'Error message';
  output.error(testMessage);
  
  assert.strictEqual(global._consoleError.length, 1);
  assert.ok(global._consoleError[0].includes('Error:'));
  assert.ok(global._consoleError[0].includes(testMessage));
});

test('output.section should print a boxen-formatted section header', () => {
  const sectionTitle = 'Test Section';
  output.section(sectionTitle);
  
  // Boxen outputs a single formatted string
  assert.strictEqual(global._consoleOutput.length, 1);
  assert.ok(global._consoleOutput[0].includes(sectionTitle));
  // Check for boxen round border character
  assert.ok(global._consoleOutput[0].includes('╭') || global._consoleOutput[0].includes('┌'));
});

test('output.tree should print tree output as is', () => {
  const treeOutput = '├── folder\n│   └── file.js\n└── another.js';
  output.tree(treeOutput);
  
  assert.strictEqual(global._consoleOutput.length, 1);
  assert.strictEqual(global._consoleOutput[0], treeOutput);
});

test('output.spinner should return an object with the correct methods', () => {
  const spinnerText = 'Loading...';
  const spinner = output.spinner(spinnerText);
  
  // Test that the spinner object has the expected methods
  assert.strictEqual(typeof spinner.succeed, 'function');
  assert.strictEqual(typeof spinner.fail, 'function');
  assert.strictEqual(typeof spinner.update, 'function');
  
  // Test spinner methods (these will use the mocked console)
  spinner.succeed('Task completed');
  spinner.fail('Task failed');
  spinner.update('Updating...');
  
  // We can't fully test ora's output since we're not mocking the ora library itself
  // but we can verify our wrapper functions don't throw errors
});
