# TreeTracr 🌲

A JavaScript/TypeScript dependency analyzer that traces module relationships and identifies unused code in your projects.

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

## Usage

Basic usage with default parameters:

```bash
treetracr
```

This will analyze the current directory using `./src/index.js` as the entry point.

Custom directory and entry point:

```bash
treetracr ./my-project ./src/app.js
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