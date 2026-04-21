/**
 * HTMLGenerator creates a self-contained HTML file with the Mermaid diagram.
 */
export class HTMLGenerator {
  /**
   * Generates a full HTML document for the given Mermaid syntax.
   */
  generate(mermaidSyntax: string, title: string = 'Architecture Diagram'): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #f8fafc;
            --card-bg: #ffffff;
            --text-primary: #1e293b;
            --accent-color: #3b82f6;
        }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            margin: 0;
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
        }
        header {
            background: var(--card-bg);
            padding: 1rem 2rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 10;
        }
        h1 {
            margin: 0;
            font-size: 1.25rem;
            font-weight: 600;
        }
        .controls {
            display: flex;
            gap: 1rem;
        }
        button {
            background: var(--bg-color);
            border: 1px solid #e2e8f0;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.875rem;
            transition: all 0.2s;
        }
        button:hover {
            border-color: var(--accent-color);
            color: var(--accent-color);
        }
        #diagram-container {
            flex: 1;
            overflow: auto;
            padding: 2rem;
            background: #fff;
            background-image: radial-gradient(#e2e8f0 1px, transparent 1px);
            background-size: 20px 20px;
        }
        .mermaid {
            display: flex;
            justify-content: center;
        }
        .mermaid svg {
            max-width: none !important;
            height: auto !important;
        }
    </style>
</head>
<body>
    <header>
        <h1>${title}</h1>
        <div class="controls">
            <button onclick="window.print()">Save as PDF</button>
            <button onclick="zoomIn()">Zoom In</button>
            <button onclick="zoomOut()">Zoom Out</button>
            <button onclick="resetZoom()">Reset</button>
        </div>
    </header>
    <div id="diagram-container">
        <pre class="mermaid">
${mermaidSyntax}
        </pre>
    </div>

    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
        
        mermaid.initialize({ 
            startOnLoad: true,
            theme: 'base',
            themeVariables: {
                primaryColor: '#eff6ff',
                primaryTextColor: '#1e3a8a',
                primaryBorderColor: '#3b82f6',
                lineColor: '#64748b',
                secondaryColor: '#f1f5f9',
                tertiaryColor: '#fff'
            },
            flowchart: {
                curve: 'basis',
                htmlLabels: true
            }
        });

        let scale = 1;
        const container = document.querySelector('.mermaid');
        
        window.zoomIn = () => {
            scale += 0.1;
            applyZoom();
        };
        window.zoomOut = () => {
            scale = Math.max(0.2, scale - 0.1);
            applyZoom();
        };
        window.resetZoom = () => {
            scale = 1;
            applyZoom();
        };
        
        function applyZoom() {
            const svg = document.querySelector('.mermaid svg');
            if (svg) {
                svg.style.transform = 'scale(' + scale + ')';
                svg.style.transformOrigin = 'top center';
            }
        }
    </script>
</body>
</html>`.trim();
  }
}
