// Patterns to identify imports/requires in files
export const IMPORT_PATTERNS = [
    /import\s+(?:[\w\s{},*]+from\s+)?['"]([\.\/][^'"]+)['"]/g,
    /require\s*\(\s*['"]([\.\/][^'"]+)['"]\s*\)/g,
    /import\s*\(['"]([\.\/][^'"]+)['"]\)/g  // Dynamic imports
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
