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
Scanning source directory: .
Using entry point: index.js
Found 24 JavaScript/TypeScript files

   ╭──────────────────────────╮
   │                          │
   │   UNUSED LOCAL MODULES   │
   │                          │
   ╰──────────────────────────╯

Found 2 unused local modules:
- app/types/config.ts
- eslint.config.js

   ╭──────────────────────────────────────╮
   │                                      │
   │   DEPENDENCY TREE FROM ENTRY POINT   │
   │                                      │
   ╰──────────────────────────────────────╯

└─ index.js
   └─ app/app.js
      ├─ app/config.js
      │  ├─ app/utils.js [ref: 6]
      │  │  ├─ app/logger.js [ref: 12]
      │  │  ├─ app/constants.js [ref: 11]
      │  │  └─ app/configSchema.js
      │  ├─ app/crypto-utils.js [ref: 2]
      │  ├─ app/logger.js [ref: 12]
      │  ├─ app/errors.js [ref: 6]
      │  │  ├─ app/logger.js [ref: 12]
      │  │  └─ app/constants.js [ref: 11]
      │  └─ app/constants.js [ref: 11]
      ├─ app/ssh.js [ref: 2]
      │  ├─ app/logger.js [ref: 12]
      │  ├─ app/errors.js [ref: 6]
      │  │  ├─ app/logger.js [ref: 12]
      │  │  └─ app/constants.js [ref: 11]
      │  ├─ app/utils.js [ref: 6]
      │  │  ├─ app/logger.js [ref: 12]
      │  │  ├─ app/constants.js [ref: 11]
      │  │  └─ app/configSchema.js
      │  └─ app/constants.js [ref: 11]
      ├─ app/socket.js [ref: 2]
      │  ├─ app/logger.js [ref: 12]
      │  ├─ app/errors.js [ref: 6]
      │  │  ├─ app/logger.js [ref: 12]
      │  │  └─ app/constants.js [ref: 11]
      │  ├─ app/utils.js [ref: 6]
      │  │  ├─ app/logger.js [ref: 12]
      │  │  ├─ app/constants.js [ref: 11]
      │  │  └─ app/configSchema.js
      │  └─ app/constants.js [ref: 11]
      ├─ app/routes.js
      │  ├─ app/utils.js [ref: 6]
      │  │  ├─ app/logger.js [ref: 12]
      │  │  ├─ app/constants.js [ref: 11]
      │  │  └─ app/configSchema.js
      │  ├─ app/connectionHandler.js
      │  │  ├─ app/logger.js [ref: 12]
      │  │  ├─ app/constants.js [ref: 11]
      │  │  └─ app/utils.js [ref: 6]
      │  │     ├─ app/logger.js [ref: 12]
      │  │     ├─ app/constants.js [ref: 11]
      │  │     └─ app/configSchema.js
      │  ├─ app/logger.js [ref: 12]
      │  ├─ app/middleware.js [ref: 2]
      │  │  └─ app/constants.js [ref: 11]
      │  ├─ app/errors.js [ref: 6]
      │  │  ├─ app/logger.js [ref: 12]
      │  │  └─ app/constants.js [ref: 11]
      │  └─ app/constants.js [ref: 11]
      ├─ app/middleware.js [ref: 2]
      │  └─ app/constants.js [ref: 11]
      ├─ app/server.js
      │  └─ app/logger.js [ref: 12]
      ├─ app/io.js
      │  ├─ app/logger.js [ref: 12]
      │  └─ app/constants.js [ref: 11]
      ├─ app/errors.js [ref: 6]
      │  ├─ app/logger.js [ref: 12]
      │  └─ app/constants.js [ref: 11]
      ├─ app/logger.js [ref: 12]
      └─ app/constants.js [ref: 11]


   ╭───────────────────────────╮
   │                           │
   │   CIRCULAR DEPENDENCIES   │
   │                           │
   ╰───────────────────────────╯

No circular dependencies detected!

   ╭────────────────╮
   │                │
   │   TEST FILES   │
   │                │
   ╰────────────────╯

Found 6 test files:
- tests/crypto-utils.test.js
- tests/errors.test.js
- tests/logger.test.js
- tests/socket.test.js
- tests/ssh.test.js
- tests/utils.test.js

Test Dependencies:
└─ tests/crypto-utils.test.js
   └─ app/crypto-utils.js [ref: 2]
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
