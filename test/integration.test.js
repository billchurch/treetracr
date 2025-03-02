import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

test('CLI should analyze a project directory', async () => {
  // Create a test project
  const testProjectDir = path.join(projectRoot, 'test-project');
  
  // Setup test project if it doesn't exist
  if (!fs.existsSync(testProjectDir)) {
    fs.mkdirSync(testProjectDir, { recursive: true });
    fs.mkdirSync(path.join(testProjectDir, 'src'));
    
    // Create main file
    fs.writeFileSync(path.join(testProjectDir, 'src', 'index.js'), `
      import { helper } from './helper.js';
      console.log(helper());
    `);
    
    // Create helper file
    fs.writeFileSync(path.join(testProjectDir, 'src', 'helper.js'), `
      export function helper() {
        return 'Hello from helper';
      }
    `);
    
    // Create unused file
    fs.writeFileSync(path.join(testProjectDir, 'src', 'unused.js'), `
      export function unused() {
        return 'This is never imported';
      }
    `);
    
    // Create test file
    fs.mkdirSync(path.join(testProjectDir, 'test'));
    fs.writeFileSync(path.join(testProjectDir, 'test', 'index.test.js'), `
      import { helper } from '../src/helper.js';
      // Test code here
    `);
  }
  
  // Run the CLI
  const { stdout } = await execAsync(`node ${projectRoot}/index.js ${testProjectDir}`);
  
  // Verify output contains key sections
  assert.ok(stdout.includes('UNUSED LOCAL MODULES'));
  assert.ok(stdout.includes('unused.js'));
  assert.ok(stdout.includes('DEPENDENCY TREE FROM ENTRY POINT'));
  assert.ok(stdout.includes('helper.js'));
  assert.ok(stdout.includes('TEST FILES'));
  assert.ok(stdout.includes('index.test.js'));
}, { timeout: 10000 });

// Cleanup
test.after(() => {
  fs.rmSync(path.join(projectRoot, 'test-project'), { recursive: true, force: true });
});
