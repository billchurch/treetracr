// Patterns to identify imports/requires in files
export const IMPORT_PATTERNS = [
    /import\s+.*?\s+from\s+['"](\..*?)['"]/g,        // import x from './y'
    /import\s+['"](\..*?)['"]/g,                      // import './y'
    /export\s+.*?\s+from\s+['"](\..*?)['"]/g,         // export x from './y'
    /import\(['"](\..*?)['"]\)/g,                     // import('./y')
    /require\(\s*['"](\..*?)['"]\s*\)/g,              // require('./y')
    /(?:const|let|var).*?=\s*require\(\s*['"](\..*?)['"]\s*\)/g, // const x = require('./y')
    /(?:const|let|var).*?=.*?require\(\s*['"](\..*?)['"]\s*\)/g  // const {x} = require('./y')
]
export const TEST_PATTERNS = [
    /\.test\.[jt]sx?$/,
    /\.spec\.[jt]sx?$/,
    /__tests__\//,
    /\/test\//
]

// File extensions to analyze
export const JS_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.jest']

// Directories to ignore
export const IGNORE_DIRS = ['node_modules', 'dist', 'build', '.git', 'coverage']

// Maximum cache size for file content cache
export const MAX_CACHE_SIZE = 1000; // Limit entries
