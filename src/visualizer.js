import path from 'path'
import treeify from 'treeify'
import chalk from 'chalk'
import { moduleDependencies, moduleReferences } from './analyzer.js'

/**
 * Format file path relative to source directory
 */
export function formatPath(filePath, sourceDir) {
    return path.relative(sourceDir, filePath)
}

/**
 * Track circular dependencies encountered during tree generation
 */
export const treeCircularDependencies = new Set()

/**
 * Generate enhanced dependency tree as an object for treeify
 */
export function generateDependencyTreeObject(filePath, sourceDir, visited = new Set(), currentPath = []) {
    if (visited.has(filePath)) {
        // Record this circular dependency
        const circularPath = [...currentPath, filePath]
        const circularKey = circularPath.map(p => formatPath(p, sourceDir)).join(' -> ')
        treeCircularDependencies.add(circularKey)
        
        return { "⚠️ Circular Reference": null }
    }

    visited.add(filePath)
    currentPath.push(filePath)
    const result = {}

    const dependencies = moduleDependencies.get(filePath) || []

    for (const dep of dependencies) {
        if (moduleDependencies.has(dep)) {
            const relDep = formatPath(dep, sourceDir)
            const refCount = moduleReferences.get(dep)?.length || 0

            // Create a plain string key (no chalk coloring in the key)
            const depName = refCount > 1 ? `${relDep} [ref: ${refCount}]` : relDep

            // Generate subtree recursively
            result[depName] = generateDependencyTreeObject(dep, sourceDir, new Set(visited), [...currentPath])
        }
    }

    currentPath.pop()
    return result
}

/**
 * Generate and return tree visualization
 */
export function generateDependencyTree(entryPath, sourceDir) {
    // Clear circular dependencies set before generating a new tree
    treeCircularDependencies.clear()
    
    // Create tree object with entry point as root
    const treeObj = {}
    treeObj[formatPath(entryPath, sourceDir)] = generateDependencyTreeObject(entryPath, sourceDir)

    // Generate the tree
    return treeify.asTree(treeObj, true)
}

/**
 * Get formatted circular dependencies
 */
export function getCircularDependencies(sourceDir) {
    // Use the circular dependencies that were detected during tree generation
    return Array.from(treeCircularDependencies).map(cycle => {
        return cycle
    })
}
