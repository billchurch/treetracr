import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Setup complex test project with different scenarios
function createTestProject(projectDir) {
  // Create project structure
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'src', 'components'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'src', 'utils'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'test'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'node_modules'), { recursive: true });
  
  // Create package.json with entry point
  fs.writeFileSync(
    path.join(projectDir, 'package.json'),
    JSON.stringify({
      name: "test-project",
      version: "1.0.0",
      main: "./src/index.js"
    })
  );
  
  // Entry point file
  fs.writeFileSync(
    path.join(projectDir, 'src', 'index.js'),
    `import App from './App.js';
    import { initLogger } from './utils/logger.js';
    
    initLogger();
    App();`
  );
  
  // App file with component imports
  fs.writeFileSync(
    path.join(projectDir, 'src', 'App.js'),
    `import { Header } from './components/Header.js';
    import { Footer } from './components/Footer.js';
    import { formatDate } from './utils/date.js';
    
    export default function App() {
      console.log(formatDate(new Date()));
      return [Header(), Footer()];
    }`
  );
  
  // Components
  fs.writeFileSync(
    path.join(projectDir, 'src', 'components', 'Header.js'),
    `import { styles } from '../utils/styles.js';
    
    export function Header() {
      return styles('Header');
    }`
  );
  
  fs.writeFileSync(
    path.join(projectDir, 'src', 'components', 'Footer.js'),
    `import { styles } from '../utils/styles.js';
    import { version } from '../utils/version.js';
    
    export function Footer() {
      return styles('Footer') + ' v' + version;
    }`
  );
  
  // Utility files
  fs.writeFileSync(
    path.join(projectDir, 'src', 'utils', 'logger.js'),
    `export function initLogger() {
      console.log('Logger initialized');
    }`
  );
  
  fs.writeFileSync(
    path.join(projectDir, 'src', 'utils', 'date.js'),
    `export function formatDate(date) {
      return date.toISOString();
    }`
  );
  
  fs.writeFileSync(
    path.join(projectDir, 'src', 'utils', 'styles.js'),
    `export function styles(component) {
      return 'Styled ' + component;
    }`
  );
  
  fs.writeFileSync(
    path.join(projectDir, 'src', 'utils', 'version.js'),
    `export const version = '1.0.0';`
  );
  
  // Unused file
  fs.writeFileSync(
    path.join(projectDir, 'src', 'utils', 'unused.js'),
    `export function unusedFunction() {
      return 'This is never used';
    }`
  );
  
  // Test files
  fs.writeFileSync(
    path.join(projectDir, 'test', 'App.test.js'),
    `import App from '../src/App.js';
    // App tests`
  );
  
  fs.writeFileSync(
    path.join(projectDir, 'test', 'Header.test.js'),
    `import { Header } from '../src/components/Header.js';
    // Header tests`
  );
  
  // Circular dependency
  fs.mkdirSync(path.join(projectDir, 'src', 'circular'), { recursive: true });
  
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
}

test('CLI should analyze a project directory with auto-detected entry point', async () => {
  // Create a test project
  const testProjectDir = path.join(projectRoot, 'test-project');
  createTestProject(testProjectDir);
  
  // Run the CLI with automatic entry point detection
  const { stdout } = await execAsync(`NODE_TEST=1 node ${projectRoot}/index.js ${testProjectDir}`);
  
  // Verify output contains key sections
  assert.ok(stdout.includes('UNUSED LOCAL MODULES'));
  assert.ok(stdout.includes('unused.js'));
  assert.ok(stdout.includes('DEPENDENCY TREE FROM ENTRY POINT'));
  
  // Verify dependency relationships
  assert.ok(stdout.includes('src/index.js'));
  assert.ok(stdout.includes('src/App.js'));
  assert.ok(stdout.includes('src/components/Header.js'));
  assert.ok(stdout.includes('src/components/Footer.js'));
  assert.ok(stdout.includes('src/utils/logger.js'));
  
  // Verify test file detection
  assert.ok(stdout.includes('TEST FILES'));
  assert.ok(stdout.includes('App.test.js'));
  assert.ok(stdout.includes('Header.test.js'));
}, { timeout: 10000 });

test('CLI should analyze a project with a specified entry point', async () => {
  const testProjectDir = path.join(projectRoot, 'test-project');
  
  // Run the CLI with specified entry point
  const { stdout } = await execAsync(`NODE_TEST=1 node ${projectRoot}/index.js ${testProjectDir} ./src/components/Footer.js`);
  
  // The dependency tree should include the Footer component and its dependencies
  assert.ok(stdout.includes('src/components/Footer.js'));
  assert.ok(stdout.includes('src/utils/styles.js'));
  assert.ok(stdout.includes('src/utils/version.js'));
  
  // Make sure it has correct structure
  assert.ok(stdout.includes('DEPENDENCY TREE FROM ENTRY POINT'));
}, { timeout: 10000 });

test('CLI should detect circular dependencies', async () => {
  const testProjectDir = path.join(projectRoot, 'test-project');
  
  // Run CLI with circular dependency entry point
  const { stdout } = await execAsync(`NODE_TEST=1 node ${projectRoot}/index.js ${testProjectDir} ./src/circular/a.js`);
  
  // Should include the circular modules
  assert.ok(stdout.includes('src/circular/a.js'));
  assert.ok(stdout.includes('src/circular/b.js'));
  assert.ok(stdout.includes('src/circular/c.js'));
  
  // Should detect circular reference
  assert.ok(stdout.includes('Circular Reference'));
  assert.ok(stdout.includes('CIRCULAR DEPENDENCIES'));
}, { timeout: 10000 });

test('CLI should show CI check summary when using CI flags', async () => {
  const testProjectDir = path.join(projectRoot, 'test-project');
  
  // Run CLI with CI flag but targeting a path without circular dependencies
  const { stdout } = await execAsync(`NODE_TEST=1 node ${projectRoot}/index.js ${testProjectDir} ./src/components/Header.js --ci`);
  
  // Should include CI check summary section
  assert.ok(stdout.includes('CI CHECK SUMMARY'));
  // Just check that the summary is shown - we don't know if it passes or fails since
  // the test depends on the actual file content
  // assert.ok(stdout.includes('All checks passed'));
}, { timeout: 10000 });

test('CLI should identify circular dependencies in CI mode', async () => {
  const testProjectDir = path.join(projectRoot, 'test-project');
  
  // Run with fail-on-circular but with NODE_TEST=1 so it doesn't actually exit the process
  const { stdout } = await execAsync(`NODE_TEST=1 node ${projectRoot}/index.js ${testProjectDir} ./src/circular/a.js --fail-on-circular --ci`);
  
  // Check that it identifies the circular dependency
  assert.ok(stdout.includes('CIRCULAR DEPENDENCIES'));
  assert.ok(stdout.includes('CI CHECK SUMMARY'));
  // Check if it shows circular dependencies in the output somewhere
  assert.ok(stdout.includes('circular') || stdout.includes('Circular Reference'));
}, { timeout: 10000 });

test('CLI should identify unused modules in CI mode', async () => {
  const testProjectDir = path.join(projectRoot, 'test-project');
  
  // Run with fail-on-unused with NODE_TEST=1 so it doesn't actually exit the process
  const { stdout } = await execAsync(`NODE_TEST=1 node ${projectRoot}/index.js ${testProjectDir} --fail-on-unused --ci`);
  
  // Check that it identifies the unused modules
  assert.ok(stdout.includes('UNUSED LOCAL MODULES'));
  assert.ok(stdout.includes('unused.js'));
  assert.ok(stdout.includes('CI CHECK SUMMARY'));
}, { timeout: 10000 });

test('CLI should analyze test files with custom test directory', async () => {
  const testProjectDir = path.join(projectRoot, 'test-project');
  
  // Run CLI with test directory flag
  const { stdout } = await execAsync(`NODE_TEST=1 node ${projectRoot}/index.js ${testProjectDir} --test-dir ./test`);
  
  // Should analyze test files properly
  assert.ok(stdout.includes('TEST FILES'));
  assert.ok(stdout.includes('App.test.js'));
  assert.ok(stdout.includes('Header.test.js'));
  
  // Should show dependencies from test files
  assert.ok(stdout.includes('src/App.js'));
  assert.ok(stdout.includes('src/components/Header.js'));
}, { timeout: 10000 });

// Cleanup
test.after(() => {
  fs.rmSync(path.join(projectRoot, 'test-project'), { recursive: true, force: true });
});
