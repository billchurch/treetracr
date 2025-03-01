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
 * Display help information and exit
 */
function displayHelp() {
  console.log(`
TreeTracr 🌲 - A JavaScript/TypeScript dependency analyzer

USAGE:
  treetracr [options] [directory] [entryPoint]

OPTIONS:
  -h, --help               Show this help message

ARGUMENTS:
  directory                Target directory to analyze (default: current directory)
  entryPoint               Main entry file (default: detected from package.json or ./src/index.js)

EXAMPLES:
  treetracr                           # Analyze current directory with auto-detected entry point
  treetracr ./my-project              # Analyze a specific directory
  treetracr ./my-project ./src/app.js # Analyze with custom entry point
  `)
  process.exit(0)
}

const readdir = promisify(fs.readdir)
const readFile = promisify(fs.readFile)
const stat = promisify(fs.stat)

// Command line arguments
const args = process.argv.slice(2)

// Check for help flags
if (args.includes('-h') || args.includes('--help')) {
  displayHelp()
}

// Process regular arguments if help wasn't requested
const sourceDir = args[0] || '.'

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

// Patterns to identify imports/requires in files
const IMPORT_PATTERNS = [
    /import\s+(?:[\w\s{},*]+from\s+)?['"]([\.\/][^'"]+)['"]/g,
    /require\s*\(\s*['"]([\.\/][^'"]+)['"]\s*\)/g,
    /import\s*\(['"]([\.\/][^'"]+)['"]\)/g  // Dynamic imports
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
    // Determine entry point based on package.json or fall back to default/provided value
    const entryPoint = await determineEntryPoint(sourceDir, args[1])
    
    console.log(chalk.blue(`Scanning source directory: ${sourceDir}`))
    console.log(chalk.blue(`Using entry point: ${entryPoint}`))

    // Get all JS/TS files
    const files = await scanDirectory(sourceDir)
    console.log(chalk.white(`Found ${files.length} JavaScript/TypeScript files`))

    // Build dependency maps
    await buildDependencyMaps(files)

    // Trace dependencies from entry point
    const usedModules = await traceDependenciesFromEntry(entryPoint)

    // Find truly unused modules
    const unusedModules = files.filter(file => !usedModules.has(file))

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
}

// Run the script
main().catch((error) => {
    console.error(chalk.red('Error:'), error)
    process.exit(1)
})