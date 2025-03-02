import fs from 'fs'
import path from 'path'
import { IMPORT_PATTERNS, TEST_PATTERNS, JS_EXTENSIONS } from './constants.js'
import { readFile, getPackageJson } from './fileSystem.js'
import { output } from './output.js'

// Store file dependencies
export const moduleDependencies = new Map()
// Store file references (which files import this file)
export const moduleReferences = new Map()
// Store circular dependencies
export const circularDependencies = new Map()
// Store unused package.json dependencies
export const unusedPackageDependencies = new Set()

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
        output.error(`Error reading file ${filePath}: ${error.message}`)
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
 * Detect circular dependencies in the project
 */
export function detectCircularDependencies() {
    const result = new Map()
    
    for (const [file, dependencies] of moduleDependencies.entries()) {
        // For each file, check for circular dependencies
        const visited = new Set()
        const path = []
        
        function dfs(currentFile) {
            if (path.includes(currentFile)) {
                // Found a cycle
                const cycle = [...path.slice(path.indexOf(currentFile)), currentFile]
                const cycleKey = cycle.join(' -> ')
                
                if (!result.has(cycleKey)) {
                    result.set(cycleKey, cycle)
                }
                return
            }
            
            if (visited.has(currentFile)) return
            
            visited.add(currentFile)
            path.push(currentFile)
            
            const deps = moduleDependencies.get(currentFile) || []
            for (const dep of deps) {
                dfs(dep)
            }
            
            path.pop()
        }
        
        dfs(file)
    }
    
    return result
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

/**
 * Check if dependencies in package.json are actually used in the source files
 * @param {string} sourceDir - Directory to analyze
 * @returns {Promise<Set<string>>} - Set of unused dependencies
 */
export async function checkUnusedPackageDependencies(sourceDir) {
    // Clear the set of unused dependencies
    unusedPackageDependencies.clear()
    
    // Get package.json
    const packageJson = await getPackageJson(sourceDir)
    if (!packageJson || !packageJson.dependencies) {
        return unusedPackageDependencies
    }
    
    // Get all dependencies from package.json
    const dependencies = Object.keys(packageJson.dependencies)
    
    // Get all content from source files to check for imports
    const files = Array.from(moduleDependencies.keys())
    const allContent = await Promise.all(
        files.map(async file => {
            try {
                return await readFile(file, 'utf8')
            } catch (error) {
                output.error(`Error reading file ${file}: ${error.message}`)
                return ''
            }
        })
    )
    
    // Join all content for simpler checking
    const combinedContent = allContent.join('\n')
    
    // Check each dependency
    for (const dependency of dependencies) {
        // Different patterns to match dependencies
        const importPatterns = [
            // ES6 named imports
            new RegExp(`import\\s+(?:[\\w\\s{},*]+from\\s+)?['"]${dependency}(?:[\\w\\s-./]*)['"]`, 'g'),
            // ES6 default imports
            new RegExp(`import\\s+[\\w\\s]+\\s+from\\s+['"]${dependency}(?:[\\w\\s-./]*)['"]`, 'g'),
            // ES6 namespace imports
            new RegExp(`import\\s+\\*\\s+as\\s+[\\w\\s]+\\s+from\\s+['"]${dependency}(?:[\\w\\s-./]*)['"]`, 'g'),
            // CommonJS require
            new RegExp(`require\\s*\\(\\s*['"]${dependency}(?:[\\w\\s-./]*)['"]\\s*\\)`, 'g'),
            // Dynamic imports
            new RegExp(`import\\s*\\(['"]${dependency}(?:[\\w\\s-./]*)['"]\\)`, 'g'),
            // Package references in comments or strings
            new RegExp(`['"]${dependency}(?:[\\w\\s-./]*)['"]`, 'g')
        ]
        
        // Check if dependency is used in any file
        const isUsed = importPatterns.some(pattern => pattern.test(combinedContent))
        
        if (!isUsed) {
            unusedPackageDependencies.add(dependency)
        }
    }
    
    return unusedPackageDependencies
}
