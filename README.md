# Architecture Diagram Generator

Automated architecture diagram generator for modern TypeScript projects. It scans your codebase, classifies files into layers, and generates structural Mermaid diagrams and a machine-readable JSON graph.

## Features

- **Automated Discovery**: Scans TypeScript/JavaScript projects (Next.js, etc.) automatically.
- **Layer & Domain Classification**: Group components by architectural layers and business domains.
- **Visual Mermaid Diagrams**: Generates clean, readable diagrams for documentation.
- **Agile JSON Graph**: Exports a full dependency graph for external analysis.
- **Strict Determinism**: Guaranteed identical output across runs and platforms.

## Installation

```bash
# Global installation
npm install -g architecture-diagram-generator

# Usage
architecture-generator . --output architecture.json

# Or run via npx
npx architecture-diagram-generator .
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `[project-root]` | Root directory to scan | `.` (current dir) |
| `--output, -o` | Path to save the JSON output | `[root]/architecture.json` |
| `--debug` | Enable verbose logging | `false` |
| `--version, -v` | Show version number | - |
| `--help, -h` | Show help message | - |

## Outputs

The CLI automatically generates two companion files:

1. **`architecture.md`**: Contains the visual Mermaid diagram ready for your README.
2. **`architecture.json`**: Contains the raw data structure of your graph. This file is compatible with the `architecture-analyzer` for deeper audits.

## Analysis

To run an architectural audit (cycles, rules validation, scoring), use the companion tool:

```bash
npx architecture-analyzer architecture.json
```

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
