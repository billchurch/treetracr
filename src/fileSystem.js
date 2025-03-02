import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import chalk from 'chalk'
import { JS_EXTENSIONS, IGNORE_DIRS } from './constants.js'

export const readdir = promisify(fs.readdir)
export const readFile = promisify(fs.readFile)
export const stat = promisify(fs.stat)

/**
 * Attempts to read and parse package.json from the given directory
 */
export async function getPackageJson(directory) {
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
export async function determineEntryPoint(directory, userProvidedEntry) {
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

/**
 * Check if a file should be analyzed
 */
export function shouldAnalyzeFile(filePath) {
    const ext = path.extname(filePath)
    return JS_EXTENSIONS.includes(ext)
}

/**
 * Check if a directory should be ignored
 */
export function shouldIgnoreDir(dirPath) {
    const dirName = path.basename(dirPath)
    return IGNORE_DIRS.includes(dirName)
}

/**
 * Recursively scan directory for JS/TS files
 */
export async function scanDirectory(dirPath) {
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
