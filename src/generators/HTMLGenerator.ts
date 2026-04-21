/**
 * HTMLGenerator creates a self-contained interactive dashboard.
 */
export class HTMLGenerator {
  /**
   * Generates a full HTML document with embedded graph data and client-side renderer.
   */
  generate(graph: any, projectName: string = 'Architecture Diagram'): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName} - Architecture Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #f8fafc;
            --card-bg: #ffffff;
            --text-primary: #1e293b;
            --accent-color: #3b82f6;
            --accent-soft: #eff6ff;
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
        .title-area {
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        h1 {
            margin: 0;
            font-size: 1.1rem;
            font-weight: 600;
        }
        .project-label {
            color: #64748b;
            font-weight: 400;
            font-size: 0.9rem;
        }
        .context-badge {
            background: var(--accent-soft);
            color: var(--accent-color);
            padding: 0.25rem 0.75rem;
            border-radius: 999px;
            font-size: 0.8rem;
            font-weight: 600;
            display: none;
            border: 1px solid #dbeafe;
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
        .debug-btn {
            background: #fff1f2;
            color: #e11d48;
            border: 1px solid #fecdd3;
        }
        .debug-btn:hover {
            background: #ffe4e6;
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
            cursor: pointer;
        }
        .back-btn {
            font-size: 0.75rem;
            color: #64748b;
            cursor: pointer;
            display: none;
            align-items: center;
            gap: 0.25rem;
            background: #f1f5f9;
            padding: 0.4rem 0.8rem;
            border-radius: 6px;
            font-weight: 600;
            border: 1px solid #e2e8f0;
        }
        .back-btn:hover {
            background: #e2e8f0;
            color: var(--text-primary);
        }
    </style>
</head>
<body>
    <header>
        <div class="title-area">
            <div onclick="resetView()" style="cursor:pointer">
                <span class="project-label">Project:</span>
                <h1>${projectName}</h1>
            </div>
            <div id="context-badge" class="context-badge"></div>
            <div id="back-btn" class="back-btn" onclick="resetView()">
                <span>←</span> Back to High-Level
            </div>
        </div>
        <div class="controls">
            <div class="group" id="view-group">
                <button onclick="changeView('high-level')" id="btn-high-level" class="active">High-Level</button>
                <button onclick="changeView('detailed')" id="btn-detailed">Detailed</button>
            </div>
            <div class="group" id="direction-group">
                <button onclick="setDirection('TD')" id="btn-TD">Vertical (TD)</button>
                <button onclick="setDirection('LR')" id="btn-LR" class="active">Horizontal (LR)</button>
            </div>
            <button class="action-btn debug-btn" onclick="copySyntax()">Copy Mermaid Code</button>
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
        
        const graph = ${JSON.stringify(graph)};
        let currentView = 'high-level'; 
        let currentDirection = 'LR';
        let currentDomain = null;
        let scale = 1;
        let lastSyntax = '';

        mermaid.initialize({ 
            startOnLoad: false,
            theme: 'base',
            securityLevel: 'loose',
            flowchart: { useMaxWidth: false, htmlLabels: true, curve: 'basis' },
            themeVariables: {
                primaryColor: '#eff6ff',
                primaryTextColor: '#1e3a8a',
                primaryBorderColor: '#3b82f6',
                lineColor: '#64748b'
            }
        });

        window.onNodeClick = (id) => {
            if (currentView === 'high-level') {
                const parts = id.split('_');
                const domain = parts.slice(2).join('_');
                drillDown(domain);
            }
        };

        function drillDown(domain) {
            currentDomain = domain;
            currentView = 'drill-down';
            updateUI();
            render();
        }

        window.resetView = () => {
            currentView = 'high-level';
            currentDomain = null;
            updateUI();
            render();
        };

        window.changeView = (view) => {
            currentView = view;
            currentDomain = null;
            updateUI();
            render();
        };

        window.copySyntax = () => {
            navigator.clipboard.writeText(lastSyntax).then(() => {
                alert('Mermaid syntax copied to clipboard! Paste it in the chat.');
            });
        };

        function updateUI() {
            const badge = document.getElementById('context-badge');
            const backBtn = document.getElementById('back-btn');
            const viewGroup = document.getElementById('view-group');
            
            if (currentView === 'drill-down') {
                badge.style.display = 'block';
                badge.innerText = 'Domain: ' + currentDomain;
                backBtn.style.display = 'flex';
                viewGroup.style.opacity = '0.5';
                viewGroup.style.pointerEvents = 'none';
            } else {
                badge.style.display = 'none';
                backBtn.style.display = 'none';
                viewGroup.style.opacity = '1';
                viewGroup.style.pointerEvents = 'all';
            }

            document.querySelectorAll('#view-group button').forEach(b => {
                b.classList.remove('active');
                if (b.id === 'btn-' + currentView) b.classList.add('active');
            });
        }

        window.setDirection = (dir) => {
            currentDirection = dir;
            document.querySelectorAll('#direction-group button').forEach(b => b.classList.remove('active'));
            document.getElementById('btn-' + dir).classList.add('active');
            render();
        };

        async function render() {
            lastSyntax = generateMermaidSyntax();
            const container = document.getElementById('mermaid-graph');
            container.removeAttribute('data-processed');
            container.innerHTML = lastSyntax;
            try {
                await mermaid.run({ nodes: [container] });
            } catch (err) {
                console.error('Mermaid rendering failed:', err);
            }
            applyZoom();
        }

        function generateMermaidSyntax() {
            let syntax = 'flowchart ' + currentDirection + '\\n';
            
            if (currentView === 'high-level') {
                const domainMap = new Map();
                graph.nodes.forEach(n => {
                    const layer = n.metadata.layer || 'Core';
                    const domain = n.metadata.domain || 'shared';
                    const key = layer + '_' + domain;
                    if (!domainMap.has(key)) domainMap.set(key, { layer, domain, count: 0 });
                    domainMap.get(key).count++;
                });

                const layers = [...new Set(graph.nodes.map(n => n.metadata.layer || 'Core'))];
                layers.forEach(layer => {
                    syntax += '  subgraph ' + safeId(layer) + ' ["' + cleanLabel(layer) + '"]\\n';
                    [...domainMap.values()].filter(d => d.layer === layer).forEach(d => {
                        const id = safeId(layer + '_' + d.domain);
                        syntax += '    ' + id + '["' + cleanLabel(d.domain) + ' (' + d.count + ' files)"]\\n';
                        syntax += '    click ' + id + ' call onNodeClick("' + id + '")\\n';
                    });
                    syntax += '  end\\n';
                });

                const domainEdges = new Set();
                graph.edges.forEach(e => {
                    const fromNode = graph.nodes.find(n => n.id === e.from);
                    const toNode = graph.nodes.find(n => n.id === e.to);
                    if (fromNode && toNode) {
                        const from = safeId(fromNode.metadata.layer || 'Core') + '_' + safeId(fromNode.metadata.domain || 'shared');
                        const to = safeId(toNode.metadata.layer || 'Core') + '_' + safeId(toNode.metadata.domain || 'shared');
                        if (from !== to) domainEdges.add(from + ' --> ' + to);
                    }
                });
                domainEdges.forEach(e => syntax += '  ' + e + '\\n');

            } else {
                const nodes = currentView === 'drill-down' 
                    ? graph.nodes.filter(n => (n.metadata.domain || 'shared') === currentDomain)
                    : graph.nodes;
                
                const nodeIds = new Set(nodes.map(n => n.id));

                if (currentView === 'drill-down') {
                    syntax += '  subgraph InternalView ["Internal view of ' + cleanLabel(currentDomain) + '"]\\n';
                }
                
                nodes.forEach(n => {
                    const label = n.id.split('/').pop();
                    syntax += '    ' + safeId(n.id) + '["' + cleanLabel(label) + '"]\\n';
                });

                if (currentView === 'drill-down') {
                    syntax += '  end\\n';
                }

                graph.edges.forEach(e => {
                    if (nodeIds.has(e.from) && nodeIds.has(e.to)) {
                        syntax += '  ' + safeId(e.from) + ' --> ' + safeId(e.to) + '\\n';
                    }
                });
            }
            
            return syntax;
        }

        function safeId(id) {
            return 'n_' + id.replace(/[^a-zA-Z0-9]/g, '_');
        }

        function cleanLabel(label) {
            if (!label) return 'unnamed';
            // Radical cleaning: keep only alphanumeric, space, dots, and hyphens.
            return label.replace(/[^a-zA-Z0-9 \\.\\-_]/g, '').trim();
        }

        window.zoom = (delta) => { scale = Math.max(0.1, scale + delta); applyZoom(); };
        window.resetZoom = () => { scale = 1; applyZoom(); };
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
