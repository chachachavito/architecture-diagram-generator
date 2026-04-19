# Architecture Diagram Generator

Automated architecture diagram generator and analyzer for modern TypeScript projects. It scans your codebase, classifies files into layers, and generates data-rich Mermaid diagrams with integrated health analysis.

## Features

- 🚀 **8-Stage Pipeline**: Robust flow from discovery to analysis and generation.
- 📂 **Layer & Domain Classification**: Group components by architectural layers (UI, Core, API, Lib) and business domains.
- 🛡️ **Architecture Analysis**: Integrated health score, issue detection (cycles, god objects), and improvement suggestions.
- 🤖 **AI-Generated Documentation**: Automated module descriptions and context enrichment.
- 🎯 **Strict Determinism**: Guaranteed identical output across runs and platforms.
- 🔗 **Relative Path Support**: Portable diagrams with clean node identifiers.

## Installation

```bash
# Global installation
npm install -g architecture-diagram-generator

# Usage
architecture-generator . --output architecture.json

# Or run via npx
npx architecture-diagram-generator .
```

## Architecture Analysis Pipeline (v2) 🛠️

The generator uses a sophisticated 8-stage pipeline to process your codebase:

1.  **Scan**: Discovery of all relevant files and their dependencies.
2.  **Normalize**: Conversion of absolute paths to portable relative identifiers.
3.  **Classify**: Rule-based assignment of nodes to Layers and Domains.
4.  **Enrich**: AI-powered documentation and metadata enhancement.
5.  **Compute Metrics**: Calculation of in-degree, out-degree, and centrality.
6.  **Sanitize**: Cleanup of non-serializable data for the final snapshot.
7.  **Snapshot**: Creation of an immutable, deep-frozen graph state.
8.  **Analyze**: Execution of architectural rules (God Objects, Cycles, Layer violations).

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

1. **`architecture.md` (Human-Readable)**: Contains the visual Mermaid diagram and a formatted Markdown report of your architectural health (issues, scores, and suggestions).
2. **`architecture.json` (Machine-Readable)**: Contains the raw deep-frozen data structure of your graph, metrics, and classification. Ideal for CI/CD integrations, structural audits, or feeding into LLMs/AI agents.

## Analysis Report 📊

Every run generates a detailed architectural health report:

- **Score (0-100)**: Overall health based on structural metrics.
- **Issues Table**: Severity-coded list of violations (God Objects, Circular Dependencies, etc.).
- **Suggestions**: Actionable architectural improvements.

## AI-Powered Documentation 🤖

Enable the `ai-documentation-enhancer` in your `architecture-config.json` to get automated module summaries:

```json
{
  "plugins": [
    {
      "name": "ai-documentation-enhancer",
      "enabled": true,
      "config": {
        "service": "openai",
        "apiKey": "${OPENAI_API_KEY}"
      }
    }
  ]
}
```

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
