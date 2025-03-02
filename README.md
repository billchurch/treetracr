# TreeTracr 🌲

A JavaScript/TypeScript dependency analyzer that helps you visualize and understand your project's dependency structure.

## Features

- Analyzes JavaScript and TypeScript projects
- Visualizes dependency trees from entry points
- Identifies unused modules
- Detects and highlights circular dependencies
- Automatically detects and analyzes test files
- Supports custom test directories

## Installation

```bash
npm install -g treetracr
```

## Usage

```bash
treetracr [options] [directory] [entryPoint]
```

### Options

- `-h, --help`: Show help message
- `-t, --test-dir <dir>`: Specify test directory (default: auto-detect)

### Examples

```bash
# Analyze current directory with auto-detected entry point
treetracr

# Analyze a specific directory
treetracr ./my-project

# Analyze with custom entry point
treetracr ./my-project ./src/app.js

# Specify test directory explicitly
treetracr --test-dir ./tests
```

## Test File Detection

TreeTracr automatically detects test files based on common patterns:
- Files with `.test.js` or `.spec.js` extensions
- Files in `__tests__` directories
- Files in directories named `test`

To override automatic detection, use the `--test-dir` option.

## Example Output

```bash
=============================================
UNUSED LOCAL MODULES
=============================================
Found 3 unused local modules:
- src/utils/deprecated.js
- src/components/experimental/NewFeature.js
- src/old-config.js

=============================================
DEPENDENCY TREE FROM ENTRY POINT
=============================================
src/index.js
├── src/app.js
│   ├── src/components/Header.js [ref: 2]
│   │   └── src/utils/styling.js
│   └── src/components/Footer.js
│       └── src/utils/styling.js
└── src/utils/helpers.js
    └── ⚠️ Circular Reference

=============================================
CIRCULAR DEPENDENCIES
=============================================
Found 1 circular dependency:
1. src/utils/helpers.js -> src/utils/formatting.js -> src/utils/helpers.js

Circular dependencies can cause issues with:
- Memory consumption
- Initialization order problems
- Harder to understand and maintain code
```

## Why TreeTracr?

- **Refactoring Aid**: Confidently remove unused code
- **Codebase Understanding**: Quickly grasp how modules relate to each other
- **Dependency Management**: Identify complex dependency chains and circular dependencies
- **Code Quality**: Improve your codebase by detecting and resolving circular dependencies
- **Onboarding Tool**: Help new team members understand the codebase structure

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
