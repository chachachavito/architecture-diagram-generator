# Architecture Diagram Generator

A powerful tool for automatically generating architecture diagrams from Next.js projects. This tool analyzes your project structure, dependencies, and integrations to create visual documentation in Mermaid format.

## Features

- **Automatic Discovery**: Scans your Next.js project structure to identify routes, API endpoints, components, and utilities.
- **Dependency Analysis**: Builds a complete dependency graph showing how modules connect.
- **External Integration Detection**: Identifies external API calls, database connections, and third-party services.
- **Intelligent Classification**: Automatically classifies modules into architectural layers (UI, API, Processing, Data).
- **Interactive Dashboard**: Export as a self-contained premium HTML page with drill-down capabilities.
- **Markdown Export**: Generates clean Mermaid syntax for inclusion in GitHub/GitLab documentation.
- **Simplified & Detailed Views**: Create high-level overviews or detailed technical diagrams.
- **Plugin System**: Extend functionality with custom plugins.
- **Change Tracking**: Track architectural changes over time.

## Installation

```bash
# Install dependencies
npm install

# Run the generator
npm run diagram
```

## Quick Start

### Basic Usage

Generate an architecture diagram for your project:

```bash
npm run diagram
```

This will generate:
- `architecture.json`: The raw dependency graph data.
- `architecture.md`: A markdown file with the Mermaid diagram.
- `architecture.html`: An interactive dashboard for exploration.

## Advanced Configuration

Create an `architecture-config.json` in your project root:

```json
{
  "rootDir": "./src",
  "exclude": ["**/*.test.ts", "**/node_modules/**"],
  "layers": {
    "UI": ["**/components/**", "**/pages/**"],
    "API": ["**/api/**", "**/hooks/**"],
    "Core": ["**/services/**", "**/utils/**"]
  }
}
```

## Integration with CI/CD

You can integrate the generator into your CI pipeline to ensure documentation is always up to date:

```yaml
- name: Generate Architecture Diagram
  run: npx architecture-diagram-generator .
```

## License

MIT
