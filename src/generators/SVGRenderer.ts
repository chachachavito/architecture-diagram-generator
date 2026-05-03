import { GraphData, IGraphRenderer, AnalysisReport } from './types';

/**
 * SVGRenderer generates a semantic, interactive SVG representation of the architecture.
 * It uses a layered vertical layout (bottom-up) and supports dark mode.
 */
export class SVGRenderer implements IGraphRenderer {
  private layers = ['External', 'Core', 'Service', 'API', 'UI'];
  private colors: Record<string, string> = {
    'UI': 'var(--c-teal)',
    'API': 'var(--c-amber)',
    'Service': 'var(--c-purple)', // Added to bridge
    'Core': 'var(--c-purple)',
    'External': 'var(--c-gray)'
  };

  render(graph: GraphData, _report?: AnalysisReport): { html: string; script: string; css: string } {
    const { nodes, edges } = graph;

    // 1. Group nodes by layer and collapse empty ones
    const nodesByLayer: Record<string, any[]> = {};
    const activeLayers = this.layers.filter(layer => 
      nodes.some(n => (n.metadata.layer || 'Core') === layer)
    );

    activeLayers.forEach(layer => {
      nodesByLayer[layer] = nodes.filter(n => (n.metadata.layer || 'Core') === layer);
    });

    // 2. Simple Layout Calculation
    const nodeWidth = 180;
    const nodeHeight = 45;
    const layerPadding = 100;
    const nodePadding = 40;
    
    let maxWidth = 0;
    activeLayers.forEach(layer => {
      const layerWidth = nodesByLayer[layer].length * (nodeWidth + nodePadding);
      if (layerWidth > maxWidth) maxWidth = layerWidth;
    });

    const svgWidth = Math.max(800, maxWidth + 100);
    const svgHeight = activeLayers.length * (nodeHeight + layerPadding) + 100;

    // Map nodes to coordinates
    const coords: Record<string, { x: number; y: number }> = {};
    
    // Reverse layers for bottom-up: [External, Core, ...] -> External at bottom
    // We render from Top (UI) at Y=50 down to External at Bottom
    const displayLayers = [...activeLayers].reverse(); 

    displayLayers.forEach((layer, lIndex) => {
      const layerNodes = nodesByLayer[layer];
      const y = 50 + lIndex * (nodeHeight + layerPadding);
      const totalLayerWidth = layerNodes.length * (nodeWidth + nodePadding) - nodePadding;
      const startX = (svgWidth - totalLayerWidth) / 2;

      layerNodes.forEach((node, nIndex) => {
        const x = startX + nIndex * (nodeWidth + nodePadding);
        coords[node.id] = { x, y };
      });
    });

    // 3. Generate SVG Elements
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" class="arch-svg">
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="var(--text-secondary)" />
        </marker>
      </defs>
      
      <rect width="100%" height="100%" fill="var(--bg-main)" />
    `;

    // Draw Edges
    edges.forEach(edge => {
      const start = coords[edge.from];
      const end = coords[edge.to];
      if (!start || !end) return;

      const isTypeOnly = edge.id.includes(':type') || (edge as any).isTypeOnly;
      const dash = isTypeOnly ? 'stroke-dasharray="4 2"' : '';

      // Simple straight lines for now, or subtle curves
      svgContent += `<path d="M ${start.x + nodeWidth / 2} ${start.y + nodeHeight} L ${end.x + nodeWidth / 2} ${end.y}" 
        stroke="var(--text-secondary)" stroke-width="0.5" fill="none" marker-end="url(#arrowhead)" ${dash} opacity="0.4" />`;
    });

    // Draw Nodes
    Object.keys(coords).forEach(nodeId => {
      const node = nodes.find(n => n.id === nodeId)!;
      const { x, y } = coords[nodeId];
      const layer = node.metadata.layer || 'Core';
      const color = this.colors[layer] || 'var(--c-gray)';
      const label = node.metadata.label || nodeId.split('/').pop();

      svgContent += `
        <a href="file://${nodeId}" target="_blank" class="node-link">
          <g class="node" transform="translate(${x}, ${y})">
            <rect width="${nodeWidth}" height="${nodeHeight}" rx="8" fill="var(--bg-card)" stroke="${color}" stroke-width="1.5" />
            <text x="${nodeWidth / 2}" y="${nodeHeight / 2 + 5}" text-anchor="middle" fill="var(--text-primary)" font-size="14" font-weight="600">${label}</text>
            <text x="${nodeWidth / 2}" y="${nodeHeight + 15}" text-anchor="middle" fill="var(--text-secondary)" font-size="10" opacity="0.7">${layer}</text>
          </g>
        </a>
      `;
    });

    svgContent += `</svg>`;

    return {
      html: svgContent,
      css: `
        :root {
          --bg-main: #0f172a;
          --bg-card: #1e293b;
          --text-primary: #f8fafc;
          --text-secondary: #94a3b8;
          --c-teal: #14b8a6;
          --c-amber: #f59e0b;
          --c-purple: #a855f7;
          --c-gray: #64748b;
        }
        @media (prefers-color-scheme: light) {
          :root {
            --bg-main: #f8fafc;
            --bg-card: #ffffff;
            --text-primary: #0f172a;
            --text-secondary: #64748b;
          }
        }
        .arch-svg { font-family: 'Inter', system-ui, sans-serif; }
        .node { cursor: pointer; transition: opacity 0.2s; }
        .node:hover { opacity: 0.8; }
        .node-link { text-decoration: none; }
      `,
      script: ''
    };
  }
}
