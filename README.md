# Architecture Diagram Generator (v0.4.15)

![Diagram](https://raw.githubusercontent.com/chachachavito/architecture-diagram-generator/main/docs/diagram.png)
*Automated architecture overview*

**Understand your TypeScript architecture in seconds.**
Automated dependency analysis and architectural visualization for modern web projects.

## Overview

Architecture Diagram Generator is a zero-config tool that transforms your codebase into high-fidelity architectural documentation. It performs deep semantic analysis using **ts-morph** to map connections, external integrations, and layers.

## Key Features

- **Automated Layer Classification**: Intelligently categorizes modules into UI, API, and Core layers based on project structure.
- **Deep Semantic Analysis**: Detects real imports, dynamic calls, and external service integrations (fetch, axios, databases).
- **Mermaid.js Integration**: Generates deterministic Mermaid syntax for Git documentation and READMEs.
- **Zero Configuration**: Works out of the box for most Next.js and TypeScript projects.

## Installation

```bash
npm install -g architecture-diagram-generator
```

## Usage

Run the generator in your project root:

```bash
architecture-generator .
```

### Output Files

- `architecture.md`: Static Mermaid diagram for GitHub/GitLab.
- `architecture.json`: Raw dependency graph data for programmatic use.
- `architecture.html`: Local interactive visualization.

## Configuration

Custom rules can be defined in an optional `architecture-config.json` file in your project root:

```json
{
  "rootDir": "./src",
  "exclude": ["**/*.test.ts", "**/node_modules/**"],
  "layers": {
    "UI": ["**/components/**"],
    "API": ["**/api/**"],
    "Core": ["**/services/**", "**/utils/**"]
  }
}
```

## Development

```bash
npm install
npm run build
npm run diagram # Test in current directory
```

## License

MIT
