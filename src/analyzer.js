import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import { IMPORT_PATTERNS, TEST_PATTERNS, JS_EXTENSIONS } from './constants.js'
import { readFile } from './fileSystem.js'

// Store file dependencies
export const moduleDependencies = new Map()
// Store file references (which files import this file)
export const moduleReferences = new Map()

/**
 * Normalize a path to handle different import styles
 */
export function normalizePath(basePath, importPath) {
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
export async function getImportsFromFile(filePath) {
    try {
        const content = await readFile(filePath, 'utf8')
        const imports = new Set()

        for (const pattern of IMPORT_PATTERNS) {
            let match
            const patternCopy = new RegExp(pattern.source, pattern.flags)
            while ((match = patternCopy.exec(content)) !== null) {
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
        console.error(chalk.red(`Error reading file ${filePath}:`), error.message)
        return []
    }
}

/**
 * Build dependency and reference maps
 */
export async function buildDependencyMaps(files) {
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
 * Trace dependencies from entry point
 */
export async function traceDependenciesFromEntry(entryPath, sourceDir, visited = new Set()) {
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
        await traceDependenciesFromEntry(dep, sourceDir, visited)
    }

    return visited
}

/**
 * Helper function to check if a file is a test
 */
export function isTestFile(filePath) {
    return TEST_PATTERNS.some(pattern => pattern.test(filePath));
}
