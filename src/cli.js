/**
 * Parse command line arguments into a structured object
 * @returns {Object} Parsed command line arguments
 */
import { output } from './output.js';

export function parseCommandLine() {
  const args = process.argv.slice(2);
  const result = {
    help: false,
    testDir: null,
    sourceDir: '.',
    entryPoint: null,
    ci: false,
    failOnCircular: false,
    failOnUnused: false,
    failOnUnusedPackageDeps: false,
    remainingArgs: []
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '-h' || arg === '--help') {
      result.help = true;
    } else if ((arg === '-t' || arg === '--test-dir') && i + 1 < args.length) {
      result.testDir = args[i + 1];
      i++; // Skip the next argument
    } else if (arg === '--ci') {
      result.ci = true;
    } else if (arg === '--fail-on-circular') {
      result.failOnCircular = true;
    } else if (arg === '--fail-on-unused') {
      result.failOnUnused = true;
    } else if (arg === '--fail-on-unused-deps') {
      result.failOnUnusedPackageDeps = true;
    } else if (!arg.startsWith('-')) {
      // Process positional arguments
      if (!result.sourceDir || result.sourceDir === '.') {
        result.sourceDir = arg;
      } else if (!result.entryPoint) {
        result.entryPoint = arg;
      } else {
        result.remainingArgs.push(arg);
      }
    } else {
      // Unknown option
      output.warning(`Warning: Unknown option ${arg}`);
    }
  }
  
  // If ci is true but no failure modes specified, enable all failure modes
  if (result.ci && !result.failOnCircular && !result.failOnUnused && !result.failOnUnusedPackageDeps) {
    result.failOnCircular = true;
    result.failOnUnused = true;
    result.failOnUnusedPackageDeps = true;
  }
  
  return result;
}

/**
 * Display help information and exit
 */
export function displayHelp() {
  output.print(`
TreeTracr 🌲 - A JavaScript/TypeScript dependency analyzer

USAGE:
  treetracr [options] [directory] [entryPoint]

OPTIONS:
  -h, --help               Show this help message
  -t, --test-dir <dir>     Specify test directory (default: auto-detect)
  --ci                     Enable CI mode (exits with error if issues found)
  --fail-on-circular       Exit with error code if circular dependencies found
  --fail-on-unused         Exit with error code if unused modules found
  --fail-on-unused-deps    Exit with error code if unused package.json dependencies found

ARGUMENTS:
  directory                Target directory to analyze (default: current directory)
  entryPoint               Main entry file (default: detected from package.json or ./src/index.js)

FEATURES:
  - Dependency Tree        Visualizes module dependencies from entry point
  - Unused Modules         Identifies modules not imported in the dependency tree
  - Circular Dependencies  Detects and highlights circular dependencies in the codebase
  - Test Files             Analyzes test files separately
  - CI Integration         Returns error codes for use in CI/CD pipelines

EXAMPLES:
  treetracr                           # Analyze current directory with auto-detected entry point
  treetracr ./my-project              # Analyze a specific directory
  treetracr ./my-project ./src/app.js # Analyze with custom entry point
  treetracr --test-dir ./tests        # Specify test directory explicitly
  treetracr --ci                      # Exit with error if circular dependencies or unused modules found
  treetracr --fail-on-circular        # Exit with error only if circular dependencies found
  `)
  process.exit(0)
}
