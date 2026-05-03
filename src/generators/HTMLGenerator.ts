import { GraphData, AnalysisReport } from './types';
import { D3Renderer } from './D3Renderer';

/**
 * HTMLGenerator creates a self-contained interactive dashboard.
 */
export class HTMLGenerator {
  private renderer = new D3Renderer();

  /**
   * Generates a full HTML document with embedded graph data and client-side renderer.
   */
  generate(graph: any, projectName: string = 'Architecture Diagram', report?: AnalysisReport): string {
    const graphData = graph as GraphData;
    const rendered = this.renderer.render(graphData, report);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName} - Architecture Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
    <style>
        :root {
            --bg-main: #020617;
            --bg-card: rgba(15, 23, 42, 0.8);
            --bg-accent: rgba(56, 189, 248, 0.15);
            --text-primary: #f1f5f9;
            --text-secondary: #94a3b8;
            --accent: #38bdf8;
            --accent-hover: #7dd3fc;
            --accent-glow: rgba(56, 189, 248, 0.5);
            --border: rgba(255, 255, 255, 0.08);
            --glass: blur(16px) saturate(200%);
            --shadow-lg: 0 20px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.3);
        }

        * { box-sizing: border-box; }

        body {
            font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
            background-color: var(--bg-main);
            background-image: 
                radial-gradient(at 0% 0%, rgba(56, 189, 248, 0.05) 0px, transparent 50%),
                radial-gradient(at 100% 0%, rgba(129, 140, 248, 0.05) 0px, transparent 50%);
            color: var(--text-primary);
            margin: 0;
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
        }

        header {
            background: var(--bg-card);
            backdrop-filter: var(--glass);
            -webkit-backdrop-filter: var(--glass);
            padding: 0.85rem 2rem;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 100;
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
        }

        .score-badge {
            background: linear-gradient(135deg, #22c55e, #16a34a);
            color: white;
            padding: 0.4rem 0.8rem;
            border-radius: 8px;
            font-weight: 800;
            font-size: 0.9rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            line-height: 1;
            box-shadow: 0 0 15px rgba(34, 197, 94, 0.3);
        }
        .score-label { font-size: 0.5rem; text-transform: uppercase; opacity: 0.8; margin-bottom: 0.2rem; }

        .logo-area {
            display: flex;
            align-items: center;
            gap: 1rem;
        }

        .logo-icon {
            width: 38px;
            height: 38px;
            background: linear-gradient(135deg, var(--accent), #818cf8);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 1.2rem;
            box-shadow: 0 0 20px var(--accent-glow);
            color: white;
        }

        h1 {
            margin: 0;
            font-size: 1.2rem;
            font-weight: 700;
            letter-spacing: -0.03em;
            background: linear-gradient(to right, #fff, #94a3b8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .issues-panel {
            position: absolute;
            top: 2rem;
            left: 2rem;
            width: 320px;
            bottom: 6rem;
            background: var(--bg-card);
            backdrop-filter: var(--glass);
            border-radius: 16px;
            border: 1px solid var(--border);
            box-shadow: var(--shadow-lg);
            padding: 1.5rem;
            z-index: 60;
            display: flex;
            flex-direction: column;
            transform: translateX(-400px);
            transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .issues-panel.open {
            transform: translateX(0);
        }

        .issues-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
        }

        .issues-list {
            flex: 1;
            overflow-y: auto;
            padding-right: 0.5rem;
        }

        .issue-item {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 1rem;
            margin-bottom: 0.75rem;
            cursor: pointer;
            transition: all 0.2s;
        }

        .issue-item:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: var(--accent);
        }

        .issue-badge {
            display: inline-block;
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-size: 0.65rem;
            font-weight: 800;
            text-transform: uppercase;
            margin-bottom: 0.5rem;
        }

        .issue-critical { background: #ef4444; color: white; }
        .issue-high { background: #f97316; color: white; }
        .issue-medium { background: #eab308; color: black; }
        .issue-low { background: #3b82f6; color: white; }

        .issue-message {
            font-size: 0.8rem;
            line-height: 1.4;
            color: var(--text-primary);
            margin-bottom: 0.5rem;
        }

        .issue-suggestion {
            font-size: 0.7rem;
            color: var(--accent);
            font-style: italic;
        }

        .main-container {
            display: flex;
            flex: 1;
            overflow: hidden;
        }

        #diagram-container {
            flex: 1;
            position: relative;
            background: var(--bg-main);
            overflow: hidden;
        }

        .legend {
            position: absolute;
            bottom: 2rem;
            left: 2rem;
            background: var(--bg-card);
            backdrop-filter: var(--glass);
            padding: 1rem;
            border-radius: 12px;
            border: 1px solid var(--border);
            z-index: 100;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            box-shadow: var(--shadow-lg);
        }

        .legend-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--text-secondary);
        }

        .legend-color {
            width: 12px;
            height: 12px;
            border-radius: 3px;
        }

        .toolbar {
            position: absolute;
            bottom: 2rem;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            align-items: center;
            gap: 0.75rem;
            background: var(--bg-card);
            backdrop-filter: var(--glass);
            padding: 0.5rem 1rem;
            border-radius: 20px;
            border: 1px solid var(--border);
            box-shadow: var(--shadow-lg);
            z-index: 100;
        }

        .view-select {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border);
            color: var(--text-primary);
            font-family: inherit;
            font-size: 0.75rem;
            font-weight: 600;
            padding: 0.4rem 0.75rem;
            border-radius: 8px;
            outline: none;
            cursor: pointer;
            transition: all 0.2s;
        }

        .view-select:hover {
            border-color: var(--accent);
        }

        .details-panel {
            position: absolute;
            top: 2rem;
            right: 2rem;
            width: 300px;
            background: var(--bg-card);
            backdrop-filter: var(--glass);
            border-radius: 16px;
            border: 1px solid var(--border);
            box-shadow: var(--shadow-lg);
            padding: 1.5rem;
            transform: translateX(400px);
            transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 60;
        }

        .details-panel.open {
            transform: translateX(0);
        }

        .btn {
            background: transparent;
            border: none;
            padding: 0.6rem 1rem;
            border-radius: 10px;
            color: var(--text-secondary);
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 0.4rem;
        }

        .btn:hover {
            color: var(--text-primary);
            background: rgba(255, 255, 255, 0.05);
        }

        .btn.active {
            color: var(--accent);
            background: var(--bg-accent);
        }

        .metric-card {
            background: rgba(0,0,0,0.2);
            padding: 0.75rem;
            border-radius: 8px;
            margin-top: 1rem;
            border: 1px solid var(--border);
        }

        .metric-value {
            font-size: 1.2rem;
            font-weight: 700;
            color: var(--accent);
        }

        .metric-label {
            font-size: 0.7rem;
            color: var(--text-secondary);
            text-transform: uppercase;
        }

        ${rendered.css}

        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--text-secondary); }

    </style>
</head>
<body>
    <header>
        <div class="logo-area" onclick="resetView()" style="cursor:pointer">
            <div class="logo-icon">A</div>
            <div>
                <div style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.1em;">Architect Dashboard</div>
                <h1>${projectName}</h1>
            </div>
        </div>
        <div class="stats-area" style="display: flex; align-items: center; gap: 2rem;">
            <div style="display: flex; gap: 1.5rem; color: var(--text-secondary); font-size: 0.8rem; font-weight: 500;">
                <div id="stat-modules"><strong>${graphData.nodes.filter(n => (n.metadata as any).type !== 'external').length}</strong> modules</div>
                <div id="stat-deps"><strong>${graphData.nodes.filter(n => (n.metadata as any).type === 'external').length}</strong> dependencies</div>
            </div>
            ${report ? `
            <div style="width: 1px; height: 24px; background: var(--border);"></div>
            <div class="score-badge" title="Architecture Health Score">
                <span class="score-label">Health Score</span>
                ${Math.round(report.score)}
            </div>
            ` : ''}
        </div>
    </header>

    <div class="main-container">
        <main id="diagram-container">
            ${rendered.html}
            <div class="legend">
                <div class="legend-item"><div class="legend-color" style="background: #14b8a6;"></div> UI</div>
                <div class="legend-item"><div class="legend-color" style="background: #f59e0b;"></div> API</div>
                <div class="legend-item"><div class="legend-color" style="background: #fb923c;"></div> Action</div>
                <div class="legend-item"><div class="legend-color" style="background: #818cf8;"></div> Service</div>
                <div class="legend-item"><div class="legend-color" style="background: #a855f7;"></div> Core</div>
                <div class="legend-item"><div class="legend-color" style="background: #64748b;"></div> External</div>

                <div style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--border);">
                    <div style="font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); margin-bottom: 0.5rem; font-weight: 700;">Complexity</div>
                    <div class="legend-item"><div class="legend-color" style="background: #22c55e;"></div> Low</div>
                    <div class="legend-item"><div class="legend-color" style="background: #eab308;"></div> Medium</div>
                    <div class="legend-item"><div class="legend-color" style="background: #f97316;"></div> High</div>
                    <div class="legend-item"><div class="legend-color" style="background: #ef4444;"></div> Critical</div>
                </div>
            </div>

            <div id="issues-panel" class="issues-panel">
                <div class="issues-header">
                    <h2 style="margin: 0; font-size: 1.1rem;">Issues Explorer</h2>
                    <button onclick="toggleIssues()" style="background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">&times;</button>
                </div>
                <div class="issues-list" id="issues-list">
                    ${report?.issues.map(issue => `
                        <div class="issue-item" onclick="focusNode('${issue.nodeId}')">
                            <span class="issue-badge issue-${issue.severity}">${issue.severity}</span>
                            <div class="issue-message">${issue.message}</div>
                            ${issue.suggestion ? `<div class="issue-suggestion">💡 ${issue.suggestion}</div>` : ''}
                        </div>
                    `).join('') || '<p style="color: var(--text-secondary); font-size: 0.8rem;">No issues detected.</p>'}
                </div>
            </div>
            <div id="details-panel" class="details-panel">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                    <h2 id="details-title" style="margin: 0; font-size: 1.1rem; color: var(--accent);">Node Details</h2>
                    <button onclick="closeDetails()" style="background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">&times;</button>
                </div>
                <div id="details-content">
                    <p style="font-size: 0.85rem; color: var(--text-secondary);">Select a node to view its architectural properties.</p>
                </div>
            </div>
            <div class="toolbar">
                <div style="display: flex; align-items: center; background: rgba(0,0,0,0.2); padding: 0.25rem 0.75rem; border-radius: 12px; border: 1px solid var(--border); width: 200px;">
                    <span style="font-size: 0.8rem; opacity: 0.5; margin-right: 0.5rem;">🔍</span>
                    <input type="text" id="node-search" placeholder="Search module..." 
                        style="background: transparent; border: none; color: #fff; font-size: 0.75rem; outline: none; width: 100%;"
                        oninput="window.searchNodes(this.value)">
                </div>
                <div style="width: 1px; height: 24px; background: var(--border); margin: 0 0.25rem;"></div>
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-right: 0.5rem;">
                    <span style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Domain</span>
                    <select class="view-select" onchange="window.filterDomain(this.value)">
                        <option value="">All Domains</option>
                        ${Array.from(new Set(graphData.nodes.map(n => n.metadata.domain || 'shared'))).sort().map(d => `<option value="${d}">${d}</option>`).join('')}
                    </select>
                </div>
                <div style="width: 1px; height: 24px; background: var(--border); margin: 0 0.25rem;"></div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <button class="btn" id="btn-issues" onclick="toggleIssues()">Issues (${report?.issues.length || 0})</button>
                    <div style="width: 1px; height: 16px; background: var(--border); margin: 0 0.25rem;"></div>
                    <button class="btn" onclick="window.resetZoom()">Reset View</button>
                    <button class="btn" id="btn-macro" onclick="window.toggleMacroView()">Macro View</button>
                    <div style="width: 1px; height: 16px; background: var(--border); margin: 0 0.25rem;"></div>
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                        <input type="checkbox" onchange="window.toggleHotspots(this.checked)" style="accent-color: var(--accent);">
                        Hotspots only
                    </label>
                </div>
            </div>
        </main>
    </div>

    <script>
        window.addEventListener('load', () => {
            ${rendered.script}

            // UI Logic
            window.resetView = () => {
                window.resetZoom();
                closeDetails();
            };

            function showDetails(nodeId) {
                if (!window.graphData) return;
                const node = window.graphData.nodes.find(n => n.data.id === nodeId);
                if (!node) return;

                const panel = document.getElementById('details-panel');
                const title = document.getElementById('details-title');
                const content = document.getElementById('details-content');
                
                panel.classList.add('open');
                title.innerText = node.data.label || node.data.id.split('/').pop();
                
                const metrics = { sloc: node.data.sloc, complexity: node.data.complexity };
                
                content.innerHTML = '<div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 1rem; word-break: break-all; font-family: monospace; opacity: 0.7;">'
                    + node.data.id + '</div>'
                    + '<div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem;">'
                    + '<span style="background: var(--bg-accent); color: var(--accent); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 700; border: 1px solid rgba(56, 189, 248, 0.2);">' + (node.data.layer || 'CORE') + '</span>'
                    + '</div>'
                    + '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">'
                    + '<div class="metric-card"><div class="metric-value">' + (metrics.sloc || '-') + '</div><div class="metric-label">SLOC</div></div>'
                    + '<div class="metric-card"><div class="metric-value">' + (metrics.complexity || '-') + '</div><div class="metric-label">Complexity</div></div>'
                    + '</div>';
            }
            window.showDetails = showDetails;

            window.closeDetails = () => {
                document.getElementById('details-panel').classList.remove('open');
            };

            window.toggleIssues = () => {
                const panel = document.getElementById('issues-panel');
                const btn = document.getElementById('btn-issues');
                panel.classList.toggle('open');
                btn.classList.toggle('active');
            };

            window.focusNode = (nodeId) => {
                window.highlightNode(nodeId);
                window.showDetails(nodeId);
            };

            if (${!!report && report.issues.length > 0}) {
                setTimeout(() => window.toggleIssues(), 1000);
            }
        });
    </script>
</body>
</html>`;
  }
}
