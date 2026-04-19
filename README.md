# Architecture Diagram Generator

Automated architecture diagram generator and analyzer for modern TypeScript projects. It scans your codebase, classifies files into layers, and generates data-rich Mermaid diagrams with integrated analysis.

## Features

- **Pipeline**: Structured flow from discovery to analysis and generation.
- **Layer & Domain Classification**: Group components by architectural layers (UI, Core, API, Action, Service, External) and business domains.
- **Architecture Analysis**: Issue detection (cycles, god objects) and improvement suggestions.
- **Strict Determinism**: Guaranteed identical output across runs and platforms.
- **Relative Path Support**: Portable diagrams with clean node identifiers.

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

The CLI automatically generates two companion files for different use cases:

1. **`architecture.md` (Human-Readable)**: Contains the visual Mermaid diagram and a formatted Markdown report of your architectural analysis (issues and suggestions).
2. **`architecture.json` (Machine-Readable)**: Contains the raw data structure of your graph and classification. Ideal for CI/CD integrations or structural audits.

## Analysis Report

Every run generates an architectural analysis report:

- **Issues Table**: Severity-coded list of violations (God Objects, Circular Dependencies, etc.).
- **Suggestions**: Actionable architectural improvements.

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
