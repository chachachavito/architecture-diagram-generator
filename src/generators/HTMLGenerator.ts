/**
 * HTMLGenerator creates a self-contained HTML file with the Mermaid diagram.
 */
export class HTMLGenerator {
  /**
   * Generates a full HTML document for the given Mermaid syntax.
   */
  generate(detailedSyntax: string, simplifiedSyntax: string, title: string = 'Architecture Diagram'): string {
    const baseDetailed = detailedSyntax.replace(/^flowchart (TD|LR|RL|BT)\n/, '');
    const baseSimplified = simplifiedSyntax.replace(/^flowchart (TD|LR|RL|BT)\n/, '');

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
            padding: 0.75rem 1.5rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 10;
        }
        h1 {
            margin: 0;
            font-size: 1.1rem;
            font-weight: 600;
        }
        .controls {
            display: flex;
            gap: 0.5rem;
            align-items: center;
        }
        .group {
            display: flex;
            background: #f1f5f9;
            padding: 0.25rem;
            border-radius: 8px;
            gap: 0.25rem;
            margin-right: 1rem;
        }
        button {
            background: transparent;
            border: none;
            padding: 0.4rem 0.8rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.75rem;
            font-weight: 600;
            color: #64748b;
            transition: all 0.2s;
        }
        button.active {
            background: var(--card-bg);
            color: var(--accent-color);
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        button:hover:not(.active) {
            background: rgba(255,255,255,0.5);
        }
        .action-btn {
            background: var(--bg-color);
            border: 1px solid #e2e8f0;
            color: var(--text-primary);
        }
        #diagram-container {
            flex: 1;
            overflow: auto;
            padding: 2rem;
            background: #fff;
            background-image: radial-gradient(#e2e8f0 1px, transparent 1px);
            background-size: 30px 30px;
        }
        .mermaid {
            display: flex;
            justify-content: flex-start;
            align-items: flex-start;
            min-width: min-content;
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
            <div class="group" id="view-group">
                <button onclick="setView('simplified')" id="btn-simplified" class="active">High-Level</button>
                <button onclick="setView('detailed')" id="btn-detailed">Detailed</button>
            </div>
            <div class="group" id="direction-group">
                <button onclick="setDirection('TD')" id="btn-TD">Vertical (TD)</button>
                <button onclick="setDirection('LR')" id="btn-LR" class="active">Horizontal (LR)</button>
                <button onclick="setDirection('RL')" id="btn-RL">Horizontal (RL)</button>
                <button onclick="setDirection('BT')" id="btn-BT">Bottom-Up (BT)</button>
            </div>
            <button class="action-btn" onclick="window.print()">Save PDF</button>
            <button class="action-btn" onclick="zoom(0.1)">Zoom +</button>
            <button class="action-btn" onclick="zoom(-0.1)">Zoom -</button>
            <button class="action-btn" onclick="resetZoom()">Reset</button>
        </div>
    </header>
    <div id="diagram-container">
        <div class="mermaid" id="mermaid-graph"></div>
    </div>

    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
        
        const syntaxes = {
            detailed: \`${baseDetailed}\`,
            simplified: \`${baseSimplified}\`
        };
        
        let currentView = 'simplified';
        let currentDirection = 'LR';
        let scale = 1;

        mermaid.initialize({ 
            startOnLoad: false,
            theme: 'base',
            flowchart: { useMaxWidth: false, htmlLabels: true, curve: 'basis' },
            themeVariables: {
                primaryColor: '#eff6ff',
                primaryTextColor: '#1e3a8a',
                primaryBorderColor: '#3b82f6',
                lineColor: '#64748b'
            }
        });

        window.setView = async (view) => {
            currentView = view;
            document.querySelectorAll('#view-group button').forEach(b => b.classList.remove('active'));
            document.getElementById('btn-' + view).classList.add('active');
            await render();
        };

        window.setDirection = async (dir) => {
            currentDirection = dir;
            document.querySelectorAll('#direction-group button').forEach(b => b.classList.remove('active'));
            document.getElementById('btn-' + dir).classList.add('active');
            await render();
        };

        async function render() {
            const container = document.getElementById('mermaid-graph');
            container.removeAttribute('data-processed');
            container.innerHTML = 'flowchart ' + currentDirection + '\\n' + syntaxes[currentView];
            await mermaid.run({ nodes: [container] });
            applyZoom();
        }

        window.zoom = (delta) => {
            scale = Math.max(0.1, scale + delta);
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
                svg.style.transformOrigin = 'top left';
            }
        }

        render();
    </script>
</body>
</html>`.trim();
  }
}
