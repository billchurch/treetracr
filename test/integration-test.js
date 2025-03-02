import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Setup test project with circular dependencies
function createTestProject(projectDir) {
  // Create project structure
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'src', 'circular'), { recursive: true });
  
  // Create entry point
  fs.writeFileSync(
    path.join(projectDir, 'src', 'index.js'),
    `// This is the entry point
     console.log('Hello world');`
  );
  
  // Create circular dependency
  fs.writeFileSync(
    path.join(projectDir, 'src', 'circular', 'a.js'),
    `import { b } from './b.js';
    export const a = 'Module A: ' + b;`
  );
  
  fs.writeFileSync(
    path.join(projectDir, 'src', 'circular', 'b.js'),
    `import { c } from './c.js';
    export const b = 'Module B: ' + c;`
  );
  
  fs.writeFileSync(
    path.join(projectDir, 'src', 'circular', 'c.js'),
    `import { a } from './a.js';
    export const c = 'Module C: ' + a;`
  );
  
  // Create unused file
  fs.writeFileSync(
    path.join(projectDir, 'src', 'unused.js'),
    `export function unused() {
      return 'This is never used';
    }`
  );
}

// Test circular dependency detection
test('CLI should identify circular dependencies and unused modules', async (t) => {
  // Create test project in a temporary directory
  const testProjectDir = path.join(projectRoot, 'test-project-ci');
  createTestProject(testProjectDir);
  
  try {
    // Test circular dependency detection
    await t.test('should detect circular dependencies', async () => {
      const { stdout } = await execAsync(`NODE_TEST=1 node ${projectRoot}/index.js ${testProjectDir} ./src/circular/a.js --fail-on-circular`);
      
      assert.ok(stdout.includes('CIRCULAR DEPENDENCIES'));
      assert.ok(stdout.includes('circular dependencies'));
    });
    
    // Test unused modules detection
    await t.test('should detect unused modules', async () => {
      const { stdout } = await execAsync(`NODE_TEST=1 node ${projectRoot}/index.js ${testProjectDir} ./src/index.js --fail-on-unused`);
      
      assert.ok(stdout.includes('UNUSED LOCAL MODULES'));
      assert.ok(stdout.includes('unused.js'));
    });
    
  } finally {
    // Clean up test project
    fs.rmSync(testProjectDir, { recursive: true, force: true });
  }
});