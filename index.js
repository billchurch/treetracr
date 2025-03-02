#!/usr/bin/env node

import path from 'path'
import chalk from 'chalk'
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
    const usedModules = await traceDependenciesFromEntry(entryPoint, sourceDir)
    
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
            console.log(chalk.yellow(`- ${formatPath(module, sourceDir)}`))
        })
    }

    // Generate dependency tree from entry point
    console.log(chalk.green('\n============================================='))
    console.log(chalk.green('DEPENDENCY TREE FROM ENTRY POINT'))
    console.log(chalk.green('============================================='))

    const absoluteEntryPath = path.isAbsolute(entryPoint)
        ? entryPoint
        : path.resolve(sourceDir, entryPoint)

    // Generate and display the tree
    const treeOutput = generateDependencyTree(absoluteEntryPath, sourceDir)
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
            console.log(chalk.white(`- ${formatPath(file, sourceDir)}`))
        })
        
        // If a test file exists, show its dependencies
        if (testFiles.length > 0) {
            const sampleTest = testFiles[0]
            console.log(chalk.white('\nTest Dependencies:'))
            
            const testTreeOutput = generateDependencyTree(sampleTest, sourceDir)
            console.log(testTreeOutput)
        }
    }
}

// Run the script
main().catch((error) => {
    console.error(chalk.red('Error:'), error)
    process.exit(1)
})
