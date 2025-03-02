#!/usr/bin/env node

import path from 'path'
import { fileURLToPath } from 'url'

// Import our modules
import { parseCommandLine, displayHelp } from './src/cli.js'
import { scanDirectory, determineEntryPoint } from './src/fileSystem.js'
import { 
    buildDependencyMaps, 
    traceDependenciesFromEntry, 
    isTestFile 
} from './src/analyzer.js'
import { 
    formatPath, 
    generateDependencyTree 
} from './src/visualizer.js'
import { output } from './src/output.js'

// ES Modules don't have __dirname, so we create it
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
    
    output.info(`Scanning source directory: ${sourceDir}`)
    output.info(`Using entry point: ${entryPoint}`)

    // Get all JS/TS files
    const files = await scanDirectory(sourceDir)
    output.print(`Found ${files.length} JavaScript/TypeScript files`)

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
    const usedModules = await traceDependenciesFromEntry(entryPoint, sourceDir)
    
    // Find truly unused modules (excluding test files)
    const unusedModules = sourceFiles.filter(file => !usedModules.has(file))

    output.section('UNUSED LOCAL MODULES')

    if (unusedModules.length === 0) {
        output.success('No unused local modules found!')
    } else {
        output.warning(`Found ${unusedModules.length} unused local modules:`)
        unusedModules.forEach((module) => {
            output.warning(`- ${formatPath(module, sourceDir)}`)
        })
    }

    // Generate dependency tree from entry point
    output.section('DEPENDENCY TREE FROM ENTRY POINT')

    const absoluteEntryPath = path.isAbsolute(entryPoint)
        ? entryPoint
        : path.resolve(sourceDir, entryPoint)

    // Generate and display the tree
    const treeOutput = generateDependencyTree(absoluteEntryPath, sourceDir)
    output.tree(treeOutput)

    // Add new section for test files
    output.section('TEST FILES')
    
    if (testFiles.length === 0) {
        output.print('No test files detected.')
    } else {
        output.print(`Found ${testFiles.length} test files:`)
        testFiles.forEach((file) => {
            output.print(`- ${formatPath(file, sourceDir)}`)
        })
        
        // If a test file exists, show its dependencies
        if (testFiles.length > 0) {
            const sampleTest = testFiles[0]
            output.print('\nTest Dependencies:')
            
            const testTreeOutput = generateDependencyTree(sampleTest, sourceDir)
            output.tree(testTreeOutput)
        }
    }
}

// Run the script
main().catch((error) => {
    output.error(error)
    process.exit(1)
})
