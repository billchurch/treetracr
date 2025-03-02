import path from 'path'
import treeify from 'treeify'
import { moduleDependencies, moduleReferences } from './analyzer.js'

/**
 * Format file path relative to source directory
 */
export function formatPath(filePath, sourceDir) {
    return path.relative(sourceDir, filePath)
}

/**
 * Generate enhanced dependency tree as an object for treeify
 */
export function generateDependencyTreeObject(filePath, sourceDir, visited = new Set()) {
    if (visited.has(filePath)) {
        return { "Circular Reference": null }
    }

    visited.add(filePath)
    const result = {}

    const dependencies = moduleDependencies.get(filePath) || []

    for (const dep of dependencies) {
        if (moduleDependencies.has(dep)) {
            const relDep = formatPath(dep, sourceDir)
            const refCount = moduleReferences.get(dep)?.length || 0

            // Create a plain string key (no chalk coloring in the key)
            const depName = refCount > 1 ? `${relDep} [ref: ${refCount}]` : relDep

            // Generate subtree recursively
            result[depName] = generateDependencyTreeObject(dep, sourceDir, new Set(visited))
        }
    }

    return result
}

/**
 * Generate and return tree visualization
 */
export function generateDependencyTree(entryPath, sourceDir) {
    // Create tree object with entry point as root
    const treeObj = {}
    treeObj[formatPath(entryPath, sourceDir)] = generateDependencyTreeObject(entryPath, sourceDir)

    // Generate the tree
    return treeify.asTree(treeObj, true)
}
