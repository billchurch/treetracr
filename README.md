## 🌲 TreeTracr - JavaScript/TypeScript Dependency Analyzer

TreeTracr is a powerful static analysis tool that helps you understand your JavaScript/TypeScript project's dependency structure, identify unused modules, and visualize import relationships.

### New Feature: package.json Auto-detection

TreeTracr now automatically detects your project's entry point from package.json, making it easier to analyze your codebase with minimal configuration.

#### How it works:

When you run TreeTracr without specifying an entry point, it will:

1. Look for a package.json file in the target directory
2. Check the following fields in priority order:
    - `main` - Standard Node.js entry point
    - `module` - ES modules entry point
    - `browser` - Browser-targeted entry point
    - `exports` - Modern conditional exports field

For the `exports` field, TreeTracr intelligently handles its potentially complex structure, looking for:
- The default export (`exports['.']`)
- Object notation with `default` or `import` keys

Only if no entry point can be determined from package.json will TreeTracr fall back to the default `./src/index.js`.

### Usage

```bash
# Analyze current directory using entry point from package.json
treetracr

# Analyze a specific directory, using its package.json for entry point
treetracr ./my-project

# Override auto-detection with a specific entry point
treetracr ./my-project ./src/app.js
```

### Example

For a project with this package.json:

```json
{
   "name": "my-awesome-project",
   "version": "1.0.0",
   "main": "dist/index.js",
   "module": "src/index.js"
}
```

Running `treetracr` will automatically use `src/index.js` as the entry point (since "module" has higher priority than "main").

### Benefits

- **Minimal configuration**: No need to manually specify entry points for standard projects
- **Works with modern JS module patterns**: Handles various package.json configurations
- **Still flexible**: You can always override with a command-line argument

## Features

- **Dependency Visualization**: Generate clear, hierarchical trees of your codebase's import structure
- **Unused Module Detection**: Identify "dead code" that isn't connected to your entry point
- **Circular Dependency Detection**: Spot problematic circular references
- **Reference Counting**: See how many modules depend on each file
- **Flexible Configuration**: Analyze any directory with custom entry points

## Installation

```bash
npm install -g treetracr
```

Or use it directly with npx:

```bash
npx treetracr
```

## Example Output

```
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
     └── Circular Reference
```

## Why TreeTracr?

- **Refactoring Aid**: Confidently remove unused code
- **Codebase Understanding**: Quickly grasp how modules relate to each other
- **Dependency Management**: Identify complex dependency chains
- **Onboarding Tool**: Help new team members understand the codebase structure

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT