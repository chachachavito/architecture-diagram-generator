# Architecture Diagram Generator

Automated architecture diagram generator for Next.js projects. It scans your codebase, classifies files into layers and domains, and generates Mermaid-based dependency graphs.

## Features

- 🚀 **Automated Discovery**: Scans your source code for imports and exports.
- 📂 **Layer & Domain Classification**: Group components by architectural layers (UI, API, Data, etc.) and business domains.
- 📊 **Multiple Formats**: Outputs to Markdown (Mermaid) by default, with optional support for PNG and SVG.
- 🤖 **AI Integration**: (Optional) Use AI to generate architectural descriptions for your components.
- ⚙️ **Highly Configurable**: Define your own layers, domains, and filters.

## Installation
```bash
# Global installation
npm install -g architecture-diagram-generator

# Usage
architecture-generator . --format md,png

# Or run via npx
npx architecture-diagram-generator . --format svg
```

## Optional Dependencies

To keep the default installation lightweight, image export requires additional packages:

### PNG Export
Requires **Puppeteer**. Install it in your project:
```bash
npm install --save-dev puppeteer
```

### SVG Export
Requires **Mermaid CLI**. Install it globally:
```bash
npm install -g @mermaid-js/mermaid-cli
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--format` | Comma-separated formats: `md`, `png`, `svg` | `md` |
| `--output, -o` | Output file path | `architecture.md` |
| `--output-dir` | Output directory for multiple formats | `./docs` |
| `--mode` | `architecture` (filtered) or `full` | `architecture` |
| `--max-nodes` | Maximum number of nodes | `150` |
| `--no-grouping` | Disable layer grouping | `false` |
| `--simplified` | Generate simplified diagram | `true` |
| `--detailed` | Generate detailed diagram | `false` |


## Configuration

For advanced usage, create an `architecture-config.json` file in your **project root directory**. This file allows you to customize layers, domains, and enable plugins.

If no configuration file is found, the generator will use sensible defaults.

### Minimal Example

```json
{
  "rootDir": "./src",
  "layers": [
    { "name": "UI", "patterns": ["**/components/**"], "color": "#3B82F6" },
    { "name": "API", "patterns": ["**/api/**"], "color": "#10B981" }
  ]
}
```

See [architecture-config.example.json](file:///Users/bruchave/Documents/_projetos/architecture-diagram-generator/architecture-config.example.json) for a full list of available options, including domain grouping and external service tracking.

## AI-Powered Documentation 🤖

The generator includes a built-in AI plugin that can automatically generate architectural descriptions and suggest improvements directly in your diagrams.

### Enabling the AI Plugin

To use this feature, add the `ai-documentation-enhancer` plugin to your `architecture-config.json`:

```json
{
  "plugins": [
    {
      "name": "ai-documentation-enhancer",
      "enabled": true,
      "config": {
        "service": "openai",
        "apiKey": "your-api-key-here",
        "model": "gpt-4o-mini"
      }
    }
  ]
}
```

> [!TIP]
> The generator automatically loads `.env` files from your project root. You can use environment variable interpolation in your config file using the `${VAR_NAME}` syntax (e.g., `"apiKey": "${OPENAI_API_KEY}"`).

### Features

- **Automated Descriptions**: Generates concise summaries for modules and domains based on their code context.
- **Architecture Insights**: Suggests improvements for coupling, cohesion, and layering.
- **Diagram Enrichment**: Injects AI-generated insights as comments within the Mermaid source, providing valuable context without cluttering the visual graph.

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
