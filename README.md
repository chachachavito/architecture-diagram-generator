# Architecture Diagram Generator

Automated architecture diagram generator for Next.js projects. It scans your codebase, classifies files into layers and domains, and generates Mermaid-based dependency graphs.

## Features

- 🚀 **Automated Discovery**: Scans your source code for imports and exports.
- 📂 **Layer & Domain Classification**: Group components by architectural layers (UI, API, Data, etc.) and business domains.
- 📊 **Multiple Formats**: Outputs to Markdown (Mermaid), PNG, and SVG.
- 🤖 **AI Integration**: (Optional) Use AI to generate architectural descriptions for your components.
- ⚙️ **Highly Configurable**: Define your own layers, domains, and filters.

## Installation

```bash
# Global installation
npm install -g architecture-diagram-generator

# Or run via npx
npx architecture-diagram-generator . --output ./docs/architecture.md
```

## Configuration

Create an `architecture-config.json` in your root directory. See `architecture-config.example.json` for all available options.

```json
{
  "rootDir": "./src",
  "layers": [
    { "name": "UI", "patterns": ["**/components/**"], "color": "#3B82F6" }
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
