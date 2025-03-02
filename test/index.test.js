import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFilePromise = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures');
const cliPath = path.join(__dirname, '..', 'index.js');

// Helper to run the CLI with given arguments
async function runCLI(args = []) {
  try {
    const { stdout, stderr } = await execFilePromise('node', [cliPath, ...args]);
    return { stdout, stderr, code: 0 };
  } catch (err) {
    return { stdout: err.stdout, stderr: err.stderr, code: err.code };
  }
}

describe('TreeTracr CLI Tests', async () => {
  // Set up test fixtures
  before(async () => {
    // Ensure fixtures directory exists
    await fs.mkdir(fixturesDir, { recursive: true });
    
    // Create a simple project structure for testing
    const simpleProject = path.join(fixturesDir, 'simple-project');
    await fs.mkdir(simpleProject, { recursive: true });
    await fs.mkdir(path.join(simpleProject, 'src'), { recursive: true });
    
    // Create package.json
    await fs.writeFile(
      path.join(simpleProject, 'package.json'),
      JSON.stringify({
        name: "test-project",
        main: "./src/index.js"
      })
    );
    
    // Create entry file with dependencies
    await fs.writeFile(
      path.join(simpleProject, 'src', 'index.js'),
      `import './utils.js';\nimport './components/button.js';\n`
    );
    
    // Create utility file
    await fs.writeFile(
      path.join(simpleProject, 'src', 'utils.js'),
      `export const add = (a, b) => a + b;\n`
    );
    
    // Create components directory and file
    await fs.mkdir(path.join(simpleProject, 'src', 'components'), { recursive: true });
    await fs.writeFile(
      path.join(simpleProject, 'src', 'components', 'button.js'),
      `import '../utils.js';\nexport const Button = () => {};\n`
    );
    
    // Create unused file
    await fs.writeFile(
      path.join(simpleProject, 'src', 'unused.js'),
      `export const unused = () => {};\n`
    );
    
    // Create project with circular dependency
    const circularProject = path.join(fixturesDir, 'circular-project');
    await fs.mkdir(circularProject, { recursive: true });
    await fs.mkdir(path.join(circularProject, 'src'), { recursive: true });
    
    await fs.writeFile(
      path.join(circularProject, 'src', 'a.js'),
      `import './b.js';\nexport const a = () => {};\n`
    );
    
    await fs.writeFile(
      path.join(circularProject, 'src', 'b.js'),
      `import './a.js';\nexport const b = () => {};\n`
    );
    
    await fs.writeFile(
      path.join(circularProject, 'src', 'index.js'),
      `import './a.js';\n`
    );
  });
  
  // Clean up after tests
  after(async () => {
    // Remove test fixtures
    await fs.rm(fixturesDir, { recursive: true, force: true });
  });
  
  test('shows help when requested', async () => {
    const { stdout, code } = await runCLI(['--help']);
    
    assert.equal(code, 0);
    assert.match(stdout, /TreeTracr 🌲/);
    assert.match(stdout, /USAGE:/);
    assert.match(stdout, /OPTIONS:/);
  });
  
  test('analyzes a simple project structure correctly', async () => {
    const projectPath = path.join(fixturesDir, 'simple-project');
    const { stdout, code } = await runCLI([projectPath]);
    
    assert.equal(code, 0);
    
    // Check that it found the correct entry point
    assert.match(stdout, /Using entry point: \.\/src\/index\.js/);
    
    // Check that it found all our JavaScript files
    assert.match(stdout, /Found \d JavaScript\/TypeScript files/);
    
    // Check that it detected the unused module
    assert.match(stdout, /Found \d unused local modules:/);
    assert.match(stdout, /- src\/unused\.js/);
    
    // Check that dependency tree includes our files
    assert.match(stdout, /DEPENDENCY TREE FROM ENTRY POINT/);
    assert.match(stdout, /src\/index\.js/);
    assert.match(stdout, /src\/utils\.js/);
    assert.match(stdout, /src\/components\/button\.js/);
  });
  
  test('detects circular dependencies', async () => {
    const projectPath = path.join(fixturesDir, 'circular-project');
    const { stdout, code } = await runCLI([projectPath]);
    
    assert.equal(code, 0);
    
    // Check that it found our circular dependency
    assert.match(stdout, /Circular Reference/);
  });
  
  test('accepts custom entry point', async () => {
    const projectPath = path.join(fixturesDir, 'simple-project');
    const customEntry = path.join('src', 'utils.js');
    const { stdout, code } = await runCLI([projectPath, customEntry]);
    
    assert.equal(code, 0);
    
    // Check that it's using our custom entry point
    assert.match(stdout, /Using entry point: src\/utils\.js/);
    
    // Since we're starting from utils.js, index.js should be unused
    assert.match(stdout, /- src\/index\.js/);
  });
});
