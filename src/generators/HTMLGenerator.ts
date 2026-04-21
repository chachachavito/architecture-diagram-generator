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
            --bg-color: #f1f5f9;
            --card-bg: #ffffff;
            --text-primary: #0f172a;
            --text-secondary: #64748b;
            --accent-color: #2563eb;
            --accent-soft: #dbeafe;
            --border-color: #e2e8f0;
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
            border-bottom: 1px solid var(--border-color);
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
            font-size: 1rem;
            font-weight: 600;
            letter-spacing: -0.01em;
        }
        .project-label {
            color: var(--text-secondary);
            font-weight: 500;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .context-badge {
            background: var(--accent-color);
            color: white;
            padding: 0.2rem 0.75rem;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 600;
            display: none;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        .controls {
            display: flex;
            gap: 0.75rem;
            align-items: center;
        }
        .group {
            display: flex;
            background: #f8fafc;
            padding: 0.2rem;
            border-radius: 8px;
            gap: 0.2rem;
            border: 1px solid var(--border-color);
        }
        button {
            background: transparent;
            border: none;
            padding: 0.4rem 0.9rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--text-secondary);
            transition: all 0.15s ease;
        }
        button.active {
            background: white;
            color: var(--accent-color);
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        button:hover:not(.active) {
            color: var(--text-primary);
            background: #f1f5f9;
        }
        .action-btn {
            background: white;
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .action-btn:hover {
            background: #f8fafc;
        }
        #diagram-container {
            flex: 1;
            overflow: auto;
            padding: 3rem;
            background: white;
            background-image: 
                linear-gradient(var(--bg-color) 1px, transparent 1px),
                linear-gradient(90deg, var(--bg-color) 1px, transparent 1px);
            background-size: 40px 40px;
        }
        .mermaid {
            display: flex;
            justify-content: center;
            align-items: flex-start;
            min-width: min-content;
        }
        .mermaid svg {
            max-width: none !important;
            height: auto !important;
            cursor: crosshair;
            transition: transform 0.1s ease-out;
        }
        .back-btn {
            font-size: 0.75rem;
            color: var(--text-secondary);
            cursor: pointer;
            display: none;
            align-items: center;
            gap: 0.3rem;
            background: white;
            padding: 0.4rem 0.8rem;
            border-radius: 6px;
            font-weight: 600;
            border: 1px solid var(--border-color);
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .back-btn:hover {
            border-color: var(--accent-color);
            color: var(--accent-color);
        }
    </style>
</head>
<body>
    <header>
        <div class="title-area">
            <div onclick="resetView()" style="cursor:pointer">
                <span class="project-label">Project</span>
                <h1>${projectName}</h1>
            </div>
            <div id="context-badge" class="context-badge"></div>
            <div id="back-btn" class="back-btn" onclick="resetView()">
                <span>←</span> Exit Domain
            </div>
        </div>
        <div class="controls">
            <div class="group" id="view-group">
                <button onclick="changeView('high-level')" id="btn-high-level" class="active">High-Level</button>
                <button onclick="changeView('detailed')" id="btn-detailed">Detailed</button>
            </div>
            <div class="group" id="direction-group">
                <button onclick="setDirection('TD')" id="btn-TD">Vertical</button>
                <button onclick="setDirection('LR')" id="btn-LR" class="active">Horizontal</button>
            </div>
            <button class="action-btn" onclick="zoom(0.15)">Zoom +</button>
            <button class="action-btn" onclick="zoom(-0.15)">Zoom -</button>
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

        mermaid.initialize({ 
            startOnLoad: false,
            theme: 'base',
            securityLevel: 'loose',
            flowchart: { 
                useMaxWidth: false, 
                htmlLabels: true, 
                curve: 'basis',
                rankspacing: 80,
                nodespacing: 50
            },
            themeVariables: {
                primaryColor: '#ffffff',
                primaryTextColor: '#1e293b',
                primaryBorderColor: '#cbd5e1',
                lineColor: '#94a3b8',
                secondaryColor: '#f8fafc',
                tertiaryColor: '#f1f5f9'
            }
        });

        window.onNodeClick = (id) => {
            if (currentView === 'high-level') {
                // ID is n_LAYER_DOMAIN
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

        function updateUI() {
            const badge = document.getElementById('context-badge');
            const backBtn = document.getElementById('back-btn');
            const viewGroup = document.getElementById('view-group');
            
            if (currentView === 'drill-down') {
                badge.style.display = 'block';
                badge.innerText = currentDomain.toUpperCase();
                backBtn.style.display = 'flex';
                viewGroup.style.opacity = '0.4';
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
            const syntax = generateMermaidSyntax();
            const container = document.getElementById('mermaid-graph');
            container.removeAttribute('data-processed');
            container.innerHTML = syntax;
            try {
                await mermaid.run({ nodes: [container] });
            } catch (err) {
                console.error('Rendering failed', err);
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
                    const key = layer + '::' + domain;
                    if (!domainMap.has(key)) domainMap.set(key, { layer, domain, count: 0 });
                    domainMap.get(key).count++;
                });

                const layers = [...new Set(graph.nodes.map(n => n.metadata.layer || 'Core'))];
                layers.forEach(layer => {
                    syntax += '  subgraph ' + safeId(layer) + ' ["' + cleanLabel(layer) + '"]\\n';
                    [...domainMap.values()].filter(d => d.layer === layer).forEach(d => {
                        const id = getDomainId(d.layer, d.domain);
                        syntax += '    ' + id + '["' + cleanLabel(d.domain) + ' <small>(' + d.count + ' files)</small>"]\\n';
                        syntax += '    click ' + id + ' call onNodeClick("' + id + '")\\n';
                    });
                    syntax += '  end\\n';
                });

                const domainEdges = new Set();
                graph.edges.forEach(e => {
                    const fromNode = graph.nodes.find(n => n.id === e.from);
                    const toNode = graph.nodes.find(n => n.id === e.to);
                    if (fromNode && toNode) {
                        const from = getDomainId(fromNode.metadata.layer || 'Core', fromNode.metadata.domain || 'shared');
                        const to = getDomainId(toNode.metadata.layer || 'Core', toNode.metadata.domain || 'shared');
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
                    syntax += '  subgraph ' + safeId(currentDomain) + ' ["DOMAIN: ' + cleanLabel(currentDomain).toUpperCase() + '"]\\n';
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

        function getDomainId(layer, domain) {
            // Using a consistent separator that safeId will handle predictably
            return safeId('dom_' + layer + '_' + domain);
        }

        function safeId(id) {
            return 'n_' + id.replace(/[^a-zA-Z0-9]/g, '_');
        }

        function cleanLabel(label) {
            if (!label) return 'unnamed';
            return label.replace(/[^a-zA-Z0-9 \\.\\-_]/g, '').trim();
        }

        window.zoom = (delta) => { scale = Math.max(0.1, scale + delta); applyZoom(); };
        window.resetZoom = () => { scale = 1; applyZoom(); };
        function applyZoom() {
            const svg = document.querySelector('.mermaid svg');
            if (svg) {
                svg.style.transform = 'scale(' + scale + ')';
                svg.style.transformOrigin = 'top center';
            }
        }

        render();
    </script>
</body>
</html>`.trim();
  }
}
