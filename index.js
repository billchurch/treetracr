#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { fileURLToPath } from 'url'
import chalk from 'chalk'
import treeify from 'treeify'

// ES Modules don't have __dirname, so we create it
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
 /**
 * Parse command line arguments into a structured object
 * @returns {Object} Parsed command line arguments
 */
function parseCommandLine() {
  const args = process.argv.slice(2);
  const result = {
    help: false,
    testDir: null,
    sourceDir: '.',
    entryPoint: null,
    remainingArgs: []
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '-h' || arg === '--help') {
      result.help = true;
    } else if ((arg === '-t' || arg === '--test-dir') && i + 1 < args.length) {
      result.testDir = args[i + 1];
      i++; // Skip the next argument
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
      console.warn(`Warning: Unknown option ${arg}`);
    }
  }
  
  return result;
}

/**
 * Display help information and exit
 */
function displayHelp() {
  console.log(`
TreeTracr 🌲 - A JavaScript/TypeScript dependency analyzer

USAGE:
  treetracr [options] [directory] [entryPoint]

OPTIONS:
  -h, --help               Show this help message
  -t, --test-dir <dir>     Specify test directory (default: auto-detect)

ARGUMENTS:
  directory                Target directory to analyze (default: current directory)
  entryPoint               Main entry file (default: detected from package.json or ./src/index.js)

EXAMPLES:
  treetracr                           # Analyze current directory with auto-detected entry point
  treetracr ./my-project              # Analyze a specific directory
  treetracr ./my-project ./src/app.js # Analyze with custom entry point
  treetracr --test-dir ./tests        # Specify test directory explicitly
  `)
  process.exit(0)
}

const readdir = promisify(fs.readdir)
const readFile = promisify(fs.readFile)
const stat = promisify(fs.stat)

const parsedArgs = parseCommandLine();

// Check for help flags
if (parsedArgs.help) {
  displayHelp()
}

// Process regular arguments if help wasn't requested
const sourceDir = parsedArgs.sourceDir;
/**
 * Attempts to read and parse package.json from the given directory
 */
async function getPackageJson(directory) {
  const packagePath = path.join(directory, 'package.json')
  try {
    const data = await readFile(packagePath, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    return null
  }
}

/**
 * Determine entry point based on package.json or fall back to default
 */
async function determineEntryPoint(directory, userProvidedEntry) {
  // If user explicitly provided an entry point, use that
  if (userProvidedEntry) {
    return userProvidedEntry
  }

  // Try to read package.json
  const packageJson = await getPackageJson(directory)
  
  if (packageJson) {
    // Check for various entry point fields in priority order
    const entryFields = ['main', 'module', 'browser', 'exports']
    
    for (const field of entryFields) {
      if (packageJson[field]) {
        // Handle exports object (could be complex)
        if (field === 'exports' && typeof packageJson.exports === 'object') {
          // Try to get the default export
          if (packageJson.exports['.']) {
            const defaultExport = packageJson.exports['.']
            if (typeof defaultExport === 'string') {
              return defaultExport
            } else if (typeof defaultExport === 'object' && defaultExport.default) {
              return defaultExport.default
            } else if (typeof defaultExport === 'object' && defaultExport.import) {
              return defaultExport.import
            }
          }
          // If no default export or it's too complex, continue to next field
          continue
        }
        
        // For string values, use directly
        return packageJson[field]
      }
    }
  }
  
  // Fall back to default entry point
  return './src/index.js'
}

  // Helper function to check if a file is a test
  function isTestFile(filePath) {
    return TEST_PATTERNS.some(pattern => pattern.test(filePath));
  }

// Patterns to identify imports/requires in files
const IMPORT_PATTERNS = [
    /import\s+(?:[\w\s{},*]+from\s+)?['"]([\.\/][^'"]+)['"]/g,
    /require\s*\(\s*['"]([\.\/][^'"]+)['"]\s*\)/g,
    /import\s*\(['"]([\.\/][^'"]+)['"]\)/g  // Dynamic imports
]

const TEST_PATTERNS = [
    /\.test\.[jt]sx?$/,
    /\.spec\.[jt]sx?$/,
    /__tests__\//,
    /\/test\//
  ]

// File extensions to analyze
const JS_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs']

// Directories to ignore
const IGNORE_DIRS = ['node_modules', 'dist', 'build', '.git', 'coverage']

// Store file dependencies
const moduleDependencies = new Map()
// Store file references (which files import this file)
const moduleReferences = new Map()

/**
 * Normalize a path to handle different import styles
 */
function normalizePath(basePath, importPath) {
    // Convert relative paths to absolute
    const fullPath = importPath.startsWith('.')
        ? path.resolve(path.dirname(basePath), importPath)
        : importPath

    // Handle directory imports (e.g., import from './utils')
    if (!path.extname(fullPath)) {
        // Try with index files
        for (const ext of JS_EXTENSIONS) {
            const indexPath = path.join(fullPath, `index${ext}`)
            if (fs.existsSync(indexPath)) {
                return indexPath
            }
        }

        // Try with extensions
        for (const ext of JS_EXTENSIONS) {
            const withExt = `${fullPath}${ext}`
            if (fs.existsSync(withExt)) {
                return withExt
            }
        }
    }

    return fullPath
}

/**
 * Extract imports from a file
 */
async function getImportsFromFile(filePath) {
    try {
        const content = await readFile(filePath, 'utf8')
        const imports = new Set()

        for (const pattern of IMPORT_PATTERNS) {
            let match
            pattern.lastIndex = 0 // Reset regex state before using
            while ((match = pattern.exec(content)) !== null) {
                const importPath = match[1]
                // Only consider local imports (starting with ./ or ../)
                if (importPath.startsWith('.')) {
                    const normalizedPath = normalizePath(filePath, importPath)
                    imports.add(normalizedPath)
                }
            }
        }

        return Array.from(imports)
    } catch (error) {
        console.error(chalk.red(`Error reading file $index.js:`), error.message)
        return []
    }
}

/**
 * Check if a file should be analyzed
 */
function shouldAnalyzeFile(filePath) {
    const ext = path.extname(filePath)
    return JS_EXTENSIONS.includes(ext)
}

/**
 * Check if a directory should be ignored
 */
function shouldIgnoreDir(dirPath) {
    const dirName = path.basename(dirPath)
    return IGNORE_DIRS.includes(dirName)
}

/**
 * Recursively scan directory for JS/TS files
 */
async function scanDirectory(dirPath) {
    const files = []
    const absPath = path.isAbsolute(dirPath) ? dirPath : path.resolve(dirPath)

    try {
        const entries = await readdir(absPath)

        for (const entry of entries) {
            const fullPath = path.join(absPath, entry)
            const stats = await stat(fullPath)

            if (stats.isDirectory()) {
                if (!shouldIgnoreDir(fullPath)) {
                    files.push(...(await scanDirectory(fullPath)))
                }
            } else if (stats.isFile() && shouldAnalyzeFile(fullPath)) {
                files.push(fullPath)
            }
        }
    } catch (error) {
        console.error(chalk.red(`Error scanning directory ${absPath}:`), error.message)
    }

    return files
}

/**
 * Build dependency and reference maps
 */
async function buildDependencyMaps(files) {
    for (const file of files) {
        const imports = await getImportsFromFile(file)
        moduleDependencies.set(file, imports)

        // Update references
        for (const importPath of imports) {
            if (!moduleReferences.has(importPath)) {
                moduleReferences.set(importPath, [])
            }
            moduleReferences.get(importPath).push(file)
        }
    }
}

/**
 * Format file path relative to source directory
 */
function formatPath(filePath) {
    return path.relative(sourceDir, filePath)
}

/**
 * Generate enhanced dependency tree as an object for treeify
 */
function generateDependencyTreeObject(filePath, visited = new Set()) {
    if (visited.has(filePath)) {
        return { "Circular Reference": null }
    }

    visited.add(filePath)
    const result = {}

    const dependencies = moduleDependencies.get(filePath) || []

    for (const dep of dependencies) {
        if (moduleDependencies.has(dep)) {
            const relDep = formatPath(dep)
            const refCount = moduleReferences.get(dep)?.length || 0

            // Create a plain string key (no chalk coloring in the key)
            const depName = refCount > 1 ? `${relDep} [ref: ${refCount}]` : relDep

            // Generate subtree recursively
            result[depName] = generateDependencyTreeObject(dep, new Set(visited))
        }
    }

    return result
}

/**
 * Trace dependencies from entry point
 */
async function traceDependenciesFromEntry(entryPath, visited = new Set()) {
    // Resolve entry path to absolute path
    const absoluteEntryPath = path.isAbsolute(entryPath)
        ? entryPath
        : path.resolve(sourceDir, entryPath)

    // Convert to normalized form for comparison with dependency map
    const normalizedPath = path.normalize(absoluteEntryPath)

    if (visited.has(normalizedPath) || !fs.existsSync(normalizedPath)) {
        return visited
    }

    visited.add(normalizedPath)

    // Look up in dependency map
    const dependencies = moduleDependencies.get(normalizedPath) || []

    for (const dep of dependencies) {
        await traceDependenciesFromEntry(dep, visited)
    }

    return visited
}

/**
 * Main function
 */
async function main() {
    // Parse command line arguments
    const options = parseCommandLine()

    // Check for help flag
    if (options.help) {
        displayHelp()
    }

    // Use the parsed options throughout the program
    const sourceDir = options.sourceDir
    const testDir = options.testDir

    // Determine entry point based on package.json or fall back to default/provided value
    const entryPoint = await determineEntryPoint(sourceDir, options.entryPoint)
    
    console.log(chalk.blue(`Scanning source directory: ${sourceDir}`))
    console.log(chalk.blue(`Using entry point: ${entryPoint}`))

    // Get all JS/TS files
    const files = await scanDirectory(sourceDir)
    console.log(chalk.white(`Found ${files.length} JavaScript/TypeScript files`))

    // Separate test files
    const testFiles = files.filter(file => {
        if (testDir) {
            // If test directory specified, use that
            return file.includes(path.resolve(testDir))
        }
        // Otherwise use automatic detection
        return isTestFile(file)
    })
    
    const sourceFiles = files.filter(file => !testFiles.includes(file))
    
    // Build dependency maps
    await buildDependencyMaps(files)

    // Trace dependencies from entry point
    const usedModules = await traceDependenciesFromEntry(entryPoint)
    // Find truly unused modules (excluding test files)
    const unusedModules = sourceFiles.filter(file => !usedModules.has(file))

    console.log(chalk.yellow('\n============================================='))
    console.log(chalk.yellow('UNUSED LOCAL MODULES'))
    console.log(chalk.yellow('============================================='))

    if (unusedModules.length === 0) {
        console.log(chalk.green('No unused local modules found!'))
    } else {
        console.log(chalk.yellow(`Found ${unusedModules.length} unused local modules:`))
        unusedModules.forEach((module) => {
            console.log(chalk.yellow(`- ${formatPath(module)}`))
        })
    }

    // Generate dependency tree from entry point
    console.log(chalk.green('\n============================================='))
    console.log(chalk.green('DEPENDENCY TREE FROM ENTRY POINT'))
    console.log(chalk.green('============================================='))

    const absoluteEntryPath = path.isAbsolute(entryPoint)
        ? entryPoint
        : path.resolve(sourceDir, entryPoint)

    // Create tree object with entry point as root
    const treeObj = {}
    treeObj[formatPath(absoluteEntryPath)] = generateDependencyTreeObject(absoluteEntryPath)

    // Generate and display the tree
    const treeOutput = treeify.asTree(treeObj, true)
    console.log(treeOutput)

    // Add new section for test files
    console.log(chalk.cyan('\n============================================='))
    console.log(chalk.cyan('TEST FILES'))
    console.log(chalk.cyan('============================================='))
    
    if (testFiles.length === 0) {
        console.log(chalk.white('No test files detected.'))
    } else {
        console.log(chalk.white(`Found ${testFiles.length} test files:`))
        testFiles.forEach((file) => {
            console.log(chalk.white(`- ${formatPath(file)}`))
        })
        
        // If a test file exists, show its dependencies
        if (testFiles.length > 0) {
            const sampleTest = testFiles[0]
            console.log(chalk.white('\nTest Dependencies:'))
            
            const testTreeObj = {}
            testTreeObj[formatPath(sampleTest)] = generateDependencyTreeObject(sampleTest)
            
            const testTreeOutput = treeify.asTree(testTreeObj, true)
            console.log(testTreeOutput)
        }
    }
}
// Run the script
main().catch((error) => {
    console.error(chalk.red('Error:'), error)
    process.exit(1)
})
