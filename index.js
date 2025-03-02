#!/usr/bin/env node

import path from 'path'
import { fileURLToPath } from 'url'

// Import our modules
import { parseCommandLine, displayHelp } from './src/cli.js'
import { scanDirectory, determineEntryPoint } from './src/fileSystem.js'
import { 
    buildDependencyMaps, 
    traceDependenciesFromEntry, 
    isTestFile, 
    detectCircularDependencies,
    checkUnusedPackageDependencies
} from './src/analyzer.js'
import { 
    formatPath, 
    generateDependencyTree,
    getCircularDependencies,
    treeCircularDependencies
} from './src/visualizer.js'
import { output } from './src/output.js'

// ES Modules don't have __dirname, so we create it
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Main function
 * @returns {Promise<number>} Exit code (0 for success, non-zero for errors)
 */
async function main() {
    // Track exit code
    let exitCode = 0;

    // Parse command line arguments
    const options = parseCommandLine()

    // Check for help flag
    if (options.help) {
        displayHelp()
        return 0; // Success exit code
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
        
        // Mark CI check as failed for unused modules
        if (options.failOnUnused) {
            output.error('CI check failed: Unused modules detected')
            if (options.ci) {
                exitCode = Math.max(exitCode, 2); // Use exit code 2 for unused modules
            }
        }
    }

    // Generate dependency tree from entry point
    output.section('DEPENDENCY TREE FROM ENTRY POINT')

    const absoluteEntryPath = path.isAbsolute(entryPoint)
        ? entryPoint
        : path.resolve(sourceDir, entryPoint)

    // Generate and display the tree
    const treeOutput = generateDependencyTree(absoluteEntryPath, sourceDir)
    output.tree(treeOutput)
    
    // Add section for circular dependencies
    output.section('CIRCULAR DEPENDENCIES')
    
    const circularDeps = getCircularDependencies(sourceDir)
    if (circularDeps.length === 0) {
        output.success('No circular dependencies detected!')
    } else {
        output.warning(`Found ${circularDeps.length} circular dependencies:`)
        circularDeps.forEach((cycle, index) => {
            output.warning(`${index + 1}. ${cycle}`)
        })
        output.print('\nCircular dependencies can cause issues with:')
        output.print('- Memory consumption')
        output.print('- Initialization order problems')
        output.print('- Harder to understand and maintain code')
        
        // Mark CI check as failed for circular dependencies
        if (options.failOnCircular) {
            output.error('CI check failed: Circular dependencies detected')
            if (options.ci) {
                exitCode = Math.max(exitCode, 1); // Use exit code 1 for circular dependencies
            }
        }
    }

    // Add section for unused package dependencies
    output.section('UNUSED PACKAGE DEPENDENCIES')
    
    // Check for unused dependencies in package.json
    const unusedDeps = await checkUnusedPackageDependencies(sourceDir)
    
    if (unusedDeps.size === 0) {
        output.success('No unused package.json dependencies found!')
    } else {
        output.warning(`Found ${unusedDeps.size} unused package.json dependencies:`)
        Array.from(unusedDeps).forEach((dep) => {
            output.warning(`- ${dep}`)
        })
        
        // Mark CI check as failed for unused package dependencies
        if (options.failOnUnusedPackageDeps) {
            output.error('CI check failed: Unused package dependencies detected')
            if (options.ci) {
                exitCode = Math.max(exitCode, 4); // Use exit code 4 for unused package dependencies
            }
        }
    }
    
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
    
    // Add summary section for CI mode
    if (options.ci || options.failOnCircular || options.failOnUnused || options.failOnUnusedPackageDeps) {
        output.section('CI CHECK SUMMARY')
        
        const hasCircularDeps = circularDeps.length > 0
        const hasUnusedModules = unusedModules.length > 0
        const hasUnusedPackageDeps = unusedDeps.size > 0
        const shouldFailCircular = options.failOnCircular && hasCircularDeps
        const shouldFailUnused = options.failOnUnused && hasUnusedModules
        const shouldFailUnusedPackageDeps = options.failOnUnusedPackageDeps && hasUnusedPackageDeps
        
        if (!shouldFailCircular && !shouldFailUnused && !shouldFailUnusedPackageDeps) {
            output.success('✅ All checks passed!')
            
            // Show details in regular mode but be concise in CI mode
            if (!options.ci) {
                if (options.failOnCircular) {
                    output.success('- No circular dependencies')
                }
                if (options.failOnUnused) {
                    output.success('- No unused modules')
                }
                if (options.failOnUnusedPackageDeps) {
                    output.success('- No unused package dependencies')
                }
            }
        } else {
            output.error('❌ CI checks failed!')
            
            if (shouldFailCircular) {
                output.error(`- Found ${circularDeps.length} circular dependencies`)
            }
            
            if (shouldFailUnused) {
                output.error(`- Found ${unusedModules.length} unused modules`)
            }
            
            if (shouldFailUnusedPackageDeps) {
                output.error(`- Found ${unusedDeps.size} unused package dependencies`)
            }
            
            // Determine exit code based on combination of failures
            if (shouldFailUnusedPackageDeps) {
                if (shouldFailCircular || shouldFailUnused) {
                    exitCode = 7;  // Exit code 7 for all issues
                } else {
                    exitCode = 4;  // Exit code 4 for unused package dependencies
                }
            } else if (shouldFailCircular && shouldFailUnused) {
                exitCode = 3;  // Exit code 3 for both circular and unused modules
            } else if (shouldFailCircular) {
                exitCode = 1;  // Exit code 1 for circular dependencies
            } else if (shouldFailUnused) {
                exitCode = 2;  // Exit code 2 for unused modules
            }
        }
    }
    
    // Return the final exit code
    return exitCode;
}

// Run the script and handle exit code
main()
    .then(exitCode => {
        // Only actually exit the process if running as a CLI application, not during testing
        if (exitCode !== 0 && !process.env.NODE_TEST) {
            process.exit(exitCode);
        }
        return exitCode;
    })
    .catch((error) => {
        output.error(error);
        // Only exit if not in a test environment
        if (!process.env.NODE_TEST) {
            process.exit(1);
        }
        return 1;
    });
