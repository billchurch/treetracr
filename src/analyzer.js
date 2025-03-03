import fs from 'fs'
import path from 'path'
import { parse } from '@babel/parser'
import { MAX_CACHE_SIZE, TEST_PATTERNS, JS_EXTENSIONS } from './constants.js'
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
                // Pre-warm the cache for files we know exist
                getCachedFileContent(indexPath).catch(() => {})
                return indexPath
            }
        }

        // Try with extensions
        for (const ext of JS_EXTENSIONS) {
            const withExt = `${fullPath}${ext}`
            if (fs.existsSync(withExt)) {
                // Pre-warm the cache for files we know exist
                getCachedFileContent(withExt).catch(() => {})
                return withExt
            }
        }
    }

    // If we get here, no valid file was found
    if (!fs.existsSync(fullPath)) {
        output.warning(`Could not resolve import: ${importPath} from ${basePath}`)
    }
    
    return fullPath
}
 /**
 * Extract imports from a file using AST parsing
 */
export async function getImportsFromFile(filePath) {
    try {
        const content = await getCachedFileContent(filePath)
        const imports = new Set()
        
        if (!content.trim()) return []
        
        try {
            const ast = parse(content, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript', 'exportDefaultFrom', 'dynamicImport'],
                errorRecovery: true
            })
            
            // Function to process import paths
            const processImportPath = (importPath) => {
                if (importPath && typeof importPath === 'string' && importPath.startsWith('.')) {
                    const normalizedPath = normalizePath(filePath, importPath)
                    imports.add(normalizedPath)
                }
            }
            
            // Walk AST nodes
            function visitNode(node) {
                // Handle standard imports: import x from 'y'
                if (node.type === 'ImportDeclaration' && node.source?.value) {
                    processImportPath(node.source.value)
                }
                
                // Handle re-exports: export x from 'y'
                else if (node.type === 'ExportNamedDeclaration' && node.source?.value) {
                    processImportPath(node.source.value)
                }
                
                // Handle bare require calls: require('./module')
                else if (node.type === 'CallExpression' && 
                          node.callee?.name === 'require' && 
                          node.arguments?.[0]?.type === 'StringLiteral') {
                    processImportPath(node.arguments[0].value)
                }
                
                // Handle dynamic imports: import('./module')
                else if (node.type === 'CallExpression' && 
                          node.callee?.type === 'Import' && 
                          node.arguments?.[0]?.type === 'StringLiteral') {
                    processImportPath(node.arguments[0].value)
                }
                
                // Handle variable declarations with requires: const x = require('./module')
                else if (node.type === 'VariableDeclaration') {
                    node.declarations.forEach(declaration => {
                        if (declaration.init?.type === 'CallExpression' && 
                            declaration.init.callee?.name === 'require' && 
                            declaration.init.arguments?.[0]?.type === 'StringLiteral') {
                            processImportPath(declaration.init.arguments[0].value)
                        }
                    })
                }
                
                // Recursively process all child nodes
                for (const key in node) {
                    const child = node[key]
                    if (child && typeof child === 'object') {
                        if (Array.isArray(child)) {
                            child.forEach(item => {
                                if (item && typeof item === 'object') {
                                    visitNode(item)
                                }
                            })
                        } else {
                            visitNode(child)
                        }
                    }
                }
            }
            
            // Start AST traversal
            if (ast.program?.body) {
                ast.program.body.forEach(visitNode)
            }
        } catch (parseError) {
            output.warning(`AST parsing failed for $src/analyzer.js, falling back to regex: ${parseError.message}`)
            return fallbackGetImports(content, filePath)
        }
        
        return Array.from(imports)
    } catch (error) {
        output.error(`Error processing file $src/analyzer.js: ${error.message}`)
        return []
    }
}
/**
 * Fallback method using regex to extract imports when AST parsing fails
 */
function fallbackGetImports(content, filePath) {
    const imports = new Set()

    for (const pattern of IMPORT_PATTERNS) {
        let match
        const patternCopy = new RegExp(pattern.source, pattern.flags)
        while ((match = patternCopy.exec(content)) !== null) {
            const importPath = match[1]
            if (importPath.startsWith('.')) {
                const normalizedPath = normalizePath(filePath, importPath)
                imports.add(normalizedPath)
            }
        }
    }

    return Array.from(imports)
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
 * @returns {Map<string, string[]>} - Map of circular dependencies
 */
// Memoize the circular dependency detection
let circularDepsCache = null;
let lastDepsMapSize = 0;

export function detectCircularDependencies() {
    // Return cached result if dependency map hasn't changed
    if (circularDepsCache && lastDepsMapSize === moduleDependencies.size) {
        return circularDepsCache;
    }
    
    const result = new Map()
    const visited = new Map(); // 0 = unvisited, 1 = in progress, 2 = completed
    const path = []
    
    function dfs(file) {
        if (visited.get(file) === 1) {
            // Found cycle
            const cycle = [...path.slice(path.indexOf(file)), file]
            const cycleKey = cycle.join(' -> ')
            if (!result.has(cycleKey)) {
                result.set(cycleKey, cycle)
            }
            return
        }
        
        if (visited.get(file) === 2) return
        
        visited.set(file, 1); // Mark as in progress
        path.push(file)
        
        const deps = moduleDependencies.get(file) || []
        for (const dep of deps) {
            dfs(dep)
        }
        
        path.pop()
        visited.set(file, 2); // Mark as completed
    }
    
    for (const file of moduleDependencies.keys()) {
        if (!visited.has(file)) {
            dfs(file)
        }
    }
    
    // Cache the result
    circularDepsCache = result;
    lastDepsMapSize = moduleDependencies.size;
    return result;
}
/** * Trace dependencies from entry point
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
    // Get package.json
    const packageJson = await getPackageJson(sourceDir)
    if (!packageJson || !packageJson.dependencies) {
        return new Set()
    }
    
    // Get all dependencies from package.json
    const dependencies = Object.keys(packageJson.dependencies)
    
    const usedDependencies = new Set()
    
    // Pattern templates
    const patternTemplates = [
        dependency => new RegExp(`import\\s+(?:[\\w\\s{},*]+from\\s+)?['"]${dependency}(?:[\\w\\s-./]*)['"]`, 'g'),
        dependency => new RegExp(`import\\s+[\\w\\s]+\\s+from\\s+['"]${dependency}(?:[\\w\\s-./]*)['"]`, 'g'),
        dependency => new RegExp(`import\\s+\\*\\s+as\\s+[\\w\\s]+\\s+from\\s+['"]${dependency}(?:[\\w\\s-./]*)['"]`, 'g'),
        dependency => new RegExp(`require\\s*\\(\\s*['"]${dependency}(?:[\\w\\s-./]*)['"]\\s*\\)`, 'g'),
        dependency => new RegExp(`import\\s*\\(['"]${dependency}(?:[\\w\\s-./]*)['"]\\)`, 'g'),
        dependency => new RegExp(`['"]${dependency}(?:[\\w\\s-./]*)['"]`, 'g')
    ]
    
    for (const file of moduleDependencies.keys()) {
        const content = await getCachedFileContent(file)
        
        for (const dependency of dependencies) {
            if (!usedDependencies.has(dependency)) {
                // Check if dependency is used in this file
                const isUsed = patternTemplates.some(template => 
                    template(dependency).test(content))
                
                if (isUsed) {
                    usedDependencies.add(dependency)
                }
            }
        }
    }
    
    // Unused = all dependencies minus used dependencies
    return new Set(dependencies.filter(dep => !usedDependencies.has(dep)))
}
// Improved cache management
const fileContentCache = new Map();

export async function getCachedFileContent(filePath) {
    if (!fileContentCache.has(filePath)) {
        try {
            // If cache is too large, remove oldest entries
            if (fileContentCache.size >= MAX_CACHE_SIZE) {
                const oldestKey = fileContentCache.keys().next().value;
                fileContentCache.delete(oldestKey);
            }
            fileContentCache.set(filePath, await readFile(filePath, 'utf8'));
        } catch (error) {
            output.error(`Error reading file ${filePath}: ${error.message}`);
            fileContentCache.set(filePath, '');
        }
    }
    return fileContentCache.get(filePath);
}

// Then use this in other functions instead of readFile directly

export function clearFileContentCache() {
    fileContentCache.clear()
}
