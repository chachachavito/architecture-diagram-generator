import { GraphData, IGraphRenderer, AnalysisReport, Issue } from './types';

// Layer order: External at top, UI at bottom (dependency direction flows down)
const LAYER_ORDER = ['UI', 'API', 'Action', 'Service', 'Core', 'External'];

const LAYER_COLORS: Record<string, string> = {
  UI: '#14b8a6',
  API: '#f59e0b',
  Action: '#fb923c',
  Service: '#818cf8',
  Core: '#a855f7',
  External: '#64748b',
};

const NODE_W = 170;
const NODE_H = 48;
const MAX_PER_ROW = 6;
const V_GAP_ROW = 20;
const H_GAP = 24;
const V_GAP = 80;
const V_GAP_DOMAIN = 32;
const LAYER_PADDING_TOP = 40;
const CANVAS_PADDING = 60;

type NodeMeta = {
  id: string;
  label: string;
  layer: string;
  domain: string;
  sloc: number;
  complexity: number;
  severity: string | null;
  isExternal: boolean;
  fanIn: number;
  fanOut: number;
  complexityTier: 'low' | 'medium' | 'high' | 'critical' | null;
};

export class D3Renderer implements IGraphRenderer {
  private isValidPath(p: string): boolean {
    const pathRegex = /^[a-zA-Z0-9/._@-]+$/;
    return pathRegex.test(p) && p.includes('/');
  }

  render(graph: GraphData, report?: AnalysisReport) {
    // ── Build issue map ──────────────────────────────────────────────────────
    const issueMap = new Map<string, Issue[]>();
    if (report?.issues) {
      for (const issue of report.issues) {
        if (!issueMap.has(issue.nodeId)) issueMap.set(issue.nodeId, []);
        issueMap.get(issue.nodeId)!.push(issue);
      }
    }
    const severityOrder: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };
    const getSeverity = (id: string) => {
      const issues = issueMap.get(id);
      if (!issues?.length) return null;
      return issues.reduce((max, i) =>
        (severityOrder[i.severity] ?? -1) > (severityOrder[max.severity] ?? -1) ? i : max
      ).severity;
    };


    // ── Build metrics ────────────────────────────────────────────────────────
    const fanInMap = new Map<string, number>();
    const fanOutMap = new Map<string, number>();
    graph.edges.forEach(e => {
      fanInMap.set(e.to, (fanInMap.get(e.to) || 0) + 1);
      fanOutMap.set(e.from, (fanOutMap.get(e.from) || 0) + 1);
    });

    const getComplexityTier = (c: number) => {
      if (c <= 0) return null;
      if (c <= 10) return 'low';
      if (c <= 30) return 'medium';
      if (c <= 60) return 'high';
      return 'critical';
    };

    // ── Group nodes by layer → domain ────────────────────────────────────────
    const byLayer = new Map<string, Map<string, NodeMeta[]>>();

    for (const n of graph.nodes) {
      const layer = n.metadata?.layer || 'Core';
      const domain = n.metadata?.domain || 'shared';
      if (!byLayer.has(layer)) byLayer.set(layer, new Map());
      const byDomain = byLayer.get(layer)!;
      if (!byDomain.has(domain)) byDomain.set(domain, []);
      byDomain.get(domain)!.push({
        id: n.id,
        label: n.metadata?.label || n.id.split('/').pop() || n.id,
        layer,
        domain,
        sloc: n.metadata?.metrics?.sloc || 0,
        complexity: n.metadata?.metrics?.complexity || 0,
        severity: getSeverity(n.id),
        isExternal: n.metadata?.type === 'external',
        fanIn: fanInMap.get(n.id) || 0,
        fanOut: fanOutMap.get(n.id) || 0,
        complexityTier: getComplexityTier(n.metadata?.metrics?.complexity || 0),
      });
    }

    // ── Calculate preset positions ───────────────────────────────────────────
    const positions: Record<string, { x: number; y: number }> = {};

    // Determine layer ordering (only layers present in data)
    const presentLayers = LAYER_ORDER.filter(l => byLayer.has(l));
    for (const l of byLayer.keys()) {
      if (!presentLayers.includes(l)) presentLayers.push(l);
    }

    // Fixed canvas width based on grid
    const canvasW = (NODE_W * MAX_PER_ROW) + (H_GAP * (MAX_PER_ROW - 1)) + (CANVAS_PADDING * 2);

    // Assign positions per layer → domain
    let currentY = CANVAS_PADDING;
    const layerBands: any[] = [];

    for (const layer of presentLayers) {
      const byDomain = byLayer.get(layer)!;
      const layerStartY = currentY;
      const domainsInfo: any[] = [];

      currentY += LAYER_PADDING_TOP;

      for (const [domainName, nodes] of byDomain) {
        const numNodes = nodes.length;
        const numRows = Math.ceil(numNodes / MAX_PER_ROW);

        domainsInfo.push({ name: domainName, y: currentY });

        nodes.forEach((node, i) => {
          const row = Math.floor(i / MAX_PER_ROW);
          const col = i % MAX_PER_ROW;

          positions[node.id] = {
            x: CANVAS_PADDING + col * (NODE_W + H_GAP) + NODE_W / 2,
            y: currentY + row * (NODE_H + V_GAP_ROW) + NODE_H / 2,
          };
        });

        currentY += numRows * (NODE_H + V_GAP_ROW) + V_GAP_DOMAIN;
      }

      const bandHeight = (currentY - V_GAP_DOMAIN) - layerStartY + 20;
      layerBands.push({
        layer,
        y: layerStartY,
        height: bandHeight,
        color: LAYER_COLORS[layer] || '#64748b',
        domains: domainsInfo,
      });

      currentY = layerStartY + bandHeight + V_GAP;
    }

    const totalHeight = currentY;

    // ── Build Macro View data ──────────────────────────────────────────────
    const macroNodes: any[] = [];
    const nodeIdToDomain = new Map<string, string>();
    
    for (const [layer, byDomain] of byLayer) {
      for (const [domainName, nodes] of byDomain) {
        const domainId = `domain__${layer}__${domainName}`;
        let sumX = 0, sumY = 0;
        nodes.forEach(n => {
          const pos = positions[n.id];
          sumX += pos.x;
          sumY += pos.y;
          nodeIdToDomain.set(n.id, domainId);
        });
        
        const count = nodes.length;
        macroNodes.push({
          id: domainId,
          label: domainName === 'shared' ? layer : domainName,
          layer,
          count,
          x: sumX / count,
          y: sumY / count
        });
      }
    }

    const macroEdgeMap = new Map<string, { from: string, to: string, weight: number }>();
    for (const edge of graph.edges) {
      const fromDom = nodeIdToDomain.get(edge.from);
      const toDom = nodeIdToDomain.get(edge.to);
      if (fromDom && toDom && fromDom !== toDom) {
        const key = `${fromDom}->${toDom}`;
        if (!macroEdgeMap.has(key)) {
          macroEdgeMap.set(key, { from: fromDom, to: toDom, weight: 0 });
        }
        macroEdgeMap.get(key)!.weight++;
      }
    }
    const macroEdges = Array.from(macroEdgeMap.values());

    const d3Nodes = graph.nodes.map(n => {
      const complexity = n.metadata?.metrics?.complexity || 0;
      const meta: NodeMeta = {
        id: n.id,
        label: n.metadata?.label || n.id.split('/').pop() || n.id,
        layer: n.metadata?.layer || 'Core',
        domain: n.metadata?.domain || 'shared',
        sloc: n.metadata?.metrics?.sloc || 0,
        complexity,
        severity: getSeverity(n.id),
        isExternal: n.metadata?.type === 'external',
        fanIn: fanInMap.get(n.id) || 0,
        fanOut: fanOutMap.get(n.id) || 0,
        complexityTier: getComplexityTier(complexity),
      };
      return {
        data: { ...meta, issueCount: (issueMap.get(n.id) || []).length },
        position: positions[n.id] || { x: 100, y: 100 },
      };
    });

    const d3Edges = graph.edges.map(e => ({
      data: {
        id: e.id,
        source: e.from,
        target: e.to,
        type: e.type,
        isTypeOnly: (e as any).isTypeOnly || false,
      },
    }));

    return {
      css: `
        #cy {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 10;
          background: var(--bg-main);
        }
        #cy svg { display: block; width: 100%; height: 100%; }
        rect.node-rect {
          rx: 8;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        line.edge {
          pointer-events: none;
        }
        text.node-label {
          font: 600 11px Outfit, sans-serif;
          pointer-events: none;
          fill: #f1f5f9;
          text-anchor: middle;
          dominant-baseline: central;
        }
        text.band-label {
          font: 700 13px Outfit, sans-serif;
          pointer-events: none;
        }
        text.domain-label {
          font: 400 10px Outfit, sans-serif;
          pointer-events: none;
        }
        rect.band {
          pointer-events: none;
        }
        rect.band-accent {
          pointer-events: none;
        }
        .node-tooltip {
          position: absolute;
          background: var(--bg-card);
          backdrop-filter: var(--glass);
          padding: 0.75rem;
          border-radius: 8px;
          border: 1px solid var(--border);
          font-size: 0.75rem;
          color: var(--text-primary);
          pointer-events: none;
          z-index: 2000;
          display: none;
          box-shadow: var(--shadow-lg);
          max-width: 260px;
        }
        .tooltip-row { display: flex; justify-content: space-between; gap: 1rem; margin-top: 0.25rem; }
        .tooltip-label { color: var(--text-secondary); }
        .issue-item { padding: 0.5rem; border-radius: 6px; margin-bottom: 0.4rem; font-size: 0.75rem; line-height: 1.4; }
        .issue-item.critical { background: rgba(239,68,68,0.15); border-left: 3px solid #ef4444; }
        .issue-item.high     { background: rgba(251,146,60,0.15);  border-left: 3px solid #fb923c; }
        .issue-item.medium   { background: rgba(251,191,36,0.15);  border-left: 3px solid #fbbf24; }
        .issue-item.low      { background: rgba(148,163,184,0.1);  border-left: 3px solid #94a3b8; }
      `,
      html: `<div id="cy"></div><div id="tooltip" class="node-tooltip"></div>`,
      script: `
        const analysisReport = ${JSON.stringify(report ?? null)};
        const issuesByNode = {};
        if (analysisReport?.issues) {
          analysisReport.issues.forEach(i => {
            if (!issuesByNode[i.nodeId]) issuesByNode[i.nodeId] = [];
            issuesByNode[i.nodeId].push(i);
          });
        }
        window.issuesByNode   = issuesByNode;
        window.analysisReport = analysisReport;

        const LAYER_COLORS = ${JSON.stringify(LAYER_COLORS)};
        const layerBands   = ${JSON.stringify(layerBands)};
        const canvasW      = ${canvasW};
        const totalHeight  = ${totalHeight};
        const NODE_W       = ${NODE_W};
        const NODE_H       = ${NODE_H};
        const macroNodes   = ${JSON.stringify(macroNodes)};
        const macroEdges   = ${JSON.stringify(macroEdges)};
        
        const COMPLEXITY_COLORS = {
          low: '#22c55e',
          medium: '#eab308',
          high: '#f97316',
          critical: '#ef4444'
        };

        const graphData = ${JSON.stringify({ nodes: d3Nodes, edges: d3Edges })};
        window.graphData = graphData;

        // ── Build position lookup ────────────────────────────────────────────
        const posMap = {};
        graphData.nodes.forEach(n => { posMap[n.data.id] = n.position; });

        // ── D3 init ──────────────────────────────────────────────────────────
        const container = document.getElementById('cy');
        const svg = d3.select(container).append('svg')
          .attr('width', '100%')
          .attr('height', '100%');

        // Arrowhead marker
        svg.append('defs').append('marker')
          .attr('id', 'arrowhead')
          .attr('viewBox', '0 0 10 10')
          .attr('refX', 9)
          .attr('refY', 5)
          .attr('markerWidth', 6)
          .attr('markerHeight', 6)
          .attr('orient', 'auto-start-reverse')
          .append('path')
            .attr('d', 'M2 1 L8 5 L2 9')
            .attr('fill', 'rgba(148,163,184,0.5)');

        // Zoom
        const d3zoom = d3.zoom()
          .scaleExtent([0.05, 3])
          .on('zoom', (e) => g.attr('transform', e.transform));
        svg.call(d3zoom);

        const g = svg.append('g');

        // ── Layer bands (SVG native) ─────────────────────────────────────────
        const bandGroup = g.append('g').attr('class', 'bands');

        // Band backgrounds
        bandGroup.selectAll('rect.band')
          .data(layerBands)
          .join('rect')
            .attr('class', 'band')
            .attr('x', 0)
            .attr('y', d => d.y)
            .attr('width', canvasW)
            .attr('height', d => d.height)
            .attr('fill', d => d.color)
            .attr('opacity', 0.1); // Using 0.1 for the '18' hex equivalent or similar softness

        // Left accent bars
        bandGroup.selectAll('rect.band-accent')
          .data(layerBands)
          .join('rect')
            .attr('class', 'band-accent')
            .attr('x', 0)
            .attr('y', d => d.y)
            .attr('width', 3)
            .attr('height', d => d.height)
            .attr('fill', d => d.color)
            .attr('opacity', 0.7);

        // Layer labels
        bandGroup.selectAll('text.band-label')
          .data(layerBands)
          .join('text')
            .attr('class', 'band-label')
            .attr('x', 10)
            .attr('y', d => d.y + 18)
            .attr('fill', d => d.color + 'cc')
            .text(d => d.layer.toUpperCase());

        // Domain labels
        layerBands.forEach(band => {
          if (band.domains) {
            bandGroup.selectAll(null)
              .data(band.domains.filter(d => d.name !== 'shared'))
              .join('text')
                .attr('class', 'domain-label')
                .attr('x', 12)
                .attr('y', d => d.y - 6)
                .attr('fill', band.color + '88')
                .text(d => d.name);
          }
        });

        // ── Edges ────────────────────────────────────────────────────────────
        const edgeGroup = g.append('g').attr('class', 'edges');

        const edgeElements = edgeGroup.selectAll('line.edge')
          .data(graphData.edges)
          .join('line')
            .attr('class', 'edge')
            .attr('x1', d => posMap[d.data.source]?.x || 0)
            .attr('y1', d => posMap[d.data.source]?.y || 0)
            .attr('x2', d => posMap[d.data.target]?.x || 0)
            .attr('y2', d => posMap[d.data.target]?.y || 0)
            .attr('stroke', 'rgba(148,163,184,0.35)')
            .attr('stroke-width', 1.5)
            .attr('opacity', 0.6)
            .attr('marker-end', 'url(#arrowhead)')
            .attr('stroke-dasharray', d => d.data.isTypeOnly ? '6 4' : null);

        // ── Nodes ────────────────────────────────────────────────────────────
        const nodeGroup = g.append('g').attr('class', 'nodes');

        const nodeElements = nodeGroup.selectAll('g.node')
          .data(graphData.nodes)
          .join('g')
            .attr('class', 'node')
            .attr('transform', d => {
              const h = NODE_H + Math.min(d.data.fanIn * 2, 20);
              return 'translate(' + (d.position.x - NODE_W/2) + ',' + (d.position.y - h/2) + ')';
            });

        // Node rect
        nodeElements.append('rect')
          .attr('class', 'node-rect')
          .attr('width', NODE_W)
          .attr('height', d => NODE_H + Math.min(d.data.fanIn * 2, 20))
          .attr('rx', 8)
          .attr('fill', '#1e293b')
          .attr('stroke', d => {
            if (d.data.severity) {
              if (d.data.severity === 'critical') return '#ef4444';
              if (d.data.severity === 'high') return '#fb923c';
              if (d.data.severity === 'medium') return '#fbbf24';
            }
            if (d.data.complexityTier) return COMPLEXITY_COLORS[d.data.complexityTier];
            return LAYER_COLORS[d.data.layer] || '#334155';
          })
          .attr('stroke-width', d => {
            if (d.data.severity === 'critical' || d.data.severity === 'high') return 3;
            if (d.data.complexityTier === 'high' || d.data.complexityTier === 'critical') return 3;
            return 2;
          })
          .attr('stroke-dasharray', d => d.data.layer === 'External' ? '6 4' : null);

        // Node label
        nodeElements.append('text')
          .attr('class', 'node-label')
          .attr('x', NODE_W / 2)
          .attr('y', d => (NODE_H + Math.min(d.data.fanIn * 2, 20)) / 2)
          .text(d => {
            const label = d.data.label;
            return label.length > 25 ? label.substring(0, 23) + '…' : label;
          });

        // Fan-in badge
        nodeElements.filter(d => d.data.fanIn >= 4)
          .append('text')
          .attr('x', NODE_W - 8)
          .attr('y', 14)
          .attr('text-anchor', 'end')
          .attr('fill', 'var(--accent)')
          .attr('font-size', '9px')
          .attr('font-weight', '800')
          .attr('opacity', 0.8)
          .text(d => '↓' + d.data.fanIn);

        // ── Tooltip ──────────────────────────────────────────────────────────
        const tooltip = document.getElementById('tooltip');

        nodeElements
          .on('mouseover', function(event, d) {
            tooltip.innerHTML =
              '<div style="font-weight:700;margin-bottom:.5rem;border-bottom:1px solid var(--border);padding-bottom:.25rem;">' + d.data.label + '</div>' +
              '<div class="tooltip-row"><span class="tooltip-label">Path</span>' + d.data.id + '</div>' +
              '<div class="tooltip-row"><span class="tooltip-label">Layer</span>' + d.data.layer + '</div>' +
              '<div class="tooltip-row"><span class="tooltip-label">Domain</span>' + d.data.domain + '</div>' +
              (d.data.sloc ? '<div class="tooltip-row"><span class="tooltip-label">SLOC</span>' + d.data.sloc + '</div>' : '') +
              (d.data.complexity ? '<div class="tooltip-row"><span class="tooltip-label">Complexity</span>' + d.data.complexity + '</div>' : '');
            tooltip.style.display = 'block';

            // Focus: fade non-connected
            const connectedIds = new Set([d.data.id]);
            graphData.edges.forEach(e => {
              if (e.data.source === d.data.id) connectedIds.add(e.data.target);
              if (e.data.target === d.data.id) connectedIds.add(e.data.source);
            });

            nodeElements.attr('opacity', n => connectedIds.has(n.data.id) ? 1 : 0.08);
            edgeElements.attr('opacity', e =>
              e.data.source === d.data.id || e.data.target === d.data.id ? 1 : 0.05
            ).attr('stroke', e =>
              e.data.source === d.data.id || e.data.target === d.data.id ? '#38bdf8' : 'rgba(148,163,184,0.35)'
            ).attr('stroke-width', e =>
              e.data.source === d.data.id || e.data.target === d.data.id ? 2.5 : 1.5
            );
          })
          .on('mousemove', function(event) {
            tooltip.style.left = (event.clientX + 16) + 'px';
            tooltip.style.top  = (event.clientY + 16) + 'px';
          })
          .on('mouseout', function() {
            tooltip.style.display = 'none';
            nodeElements.attr('opacity', 1);
            edgeElements
              .attr('opacity', 0.6)
              .attr('stroke', 'rgba(148,163,184,0.35)')
              .attr('stroke-width', 1.5);
          })
          .on('click', function(event, d) {
            window.showDetails(d.data.id);
          });

        window.filterDomain = (domain) => {
          if (!domain) {
            nodeElements.attr('opacity', 1);
            edgeElements.attr('opacity', 0.6);
            return;
          }
          nodeElements.attr('opacity', d =>
            d.data.domain === domain || d.data.layer === domain ? 1 : 0.08
          );
          edgeElements.attr('opacity', e => {
            const src = graphData.nodes.find(n => n.data.id === e.data.source);
            const tgt = graphData.nodes.find(n => n.data.id === e.data.target);
            const srcMatch = src && (src.data.domain === domain || src.data.layer === domain);
            const tgtMatch = tgt && (tgt.data.domain === domain || tgt.data.layer === domain);
            return srcMatch || tgtMatch ? 0.6 : 0.05;
          });
        };
        
        // ── Search & Focus ───────────────────────────────────────────────────
        window.searchNodes = (query) => {
          if (!query || query.length < 2) {
            nodeElements.attr('opacity', 1);
            edgeElements.attr('opacity', 0.6);
            return;
          }
          const q = query.toLowerCase();
          let firstMatch = null;
          
          nodeElements.attr('opacity', d => {
            const isMatch = d.data.label.toLowerCase().includes(q) || d.data.id.toLowerCase().includes(q);
            if (isMatch && !firstMatch) firstMatch = d;
            return isMatch ? 1 : 0.08;
          });
          
          edgeElements.attr('opacity', 0.05);
          
          if (firstMatch) {
            const cRect = container.getBoundingClientRect();
            const tx = cRect.width / 2 - firstMatch.position.x;
            const ty = cRect.height / 2 - firstMatch.position.y;
            svg.transition().duration(500).call(
              d3zoom.transform,
              d3.zoomIdentity.translate(tx, ty).scale(1)
            );
          }
        };

        // ── Reset zoom ───────────────────────────────────────────────────────
        window.resetZoom = () => {
          svg.transition().duration(400).call(
            d3zoom.transform,
            d3.zoomIdentity.translate(60, 60).scale(1)
          );
        };

        // ── Hotspot Filter ──────────────────────────────────────────────────
        window.toggleHotspots = (enabled) => {
          if (!enabled) {
            nodeElements.attr('opacity', 1);
            edgeElements.attr('opacity', 0.6);
            return;
          }
          nodeElements.attr('opacity', d => 
            d.data.complexityTier === 'high' || d.data.complexityTier === 'critical' ? 1 : 0.08
          );
          edgeElements.attr('opacity', 0.05);
        };

        // ── Macro View Toggle ────────────────────────────────────────────────
        window.isMacro = false;
        window.toggleMacroView = () => {
          window.isMacro = !window.isMacro;
          const btn = document.getElementById('btn-macro');
          if (window.isMacro) {
            btn.innerText = 'Detailed View';
            btn.classList.add('active');
            nodeGroup.attr('display', 'none');
            edgeGroup.attr('display', 'none');
            renderMacro();
          } else {
            btn.innerText = 'Macro View';
            btn.classList.remove('active');
            nodeGroup.attr('display', null);
            edgeGroup.attr('display', null);
            g.selectAll('.macro-group').remove();
          }
        };

        function renderMacro() {
          const macroGroup = g.append('g').attr('class', 'macro-group');
          
          macroGroup.selectAll('line.macro-edge')
            .data(macroEdges)
            .join('line')
              .attr('class', 'macro-edge')
              .attr('x1', d => macroNodes.find(n => n.id === d.from).x)
              .attr('y1', d => macroNodes.find(n => n.id === d.from).y)
              .attr('x2', d => macroNodes.find(n => n.id === d.to).x)
              .attr('y2', d => macroNodes.find(n => n.id === d.to).y)
              .attr('stroke', 'rgba(148,163,184,0.4)')
              .attr('stroke-width', d => Math.max(1, Math.log(d.weight + 1) * 2))
              .attr('marker-end', 'url(#arrowhead)');

          const mn = macroGroup.selectAll('g.macro-node')
            .data(macroNodes)
            .join('g')
              .attr('class', 'macro-node')
              .attr('transform', d => 'translate(' + (d.x - 80) + ',' + (d.y - 32) + ')');

          mn.append('rect')
            .attr('width', 160)
            .attr('height', 64)
            .attr('rx', 8)
            .attr('fill', d => LAYER_COLORS[d.layer] + '22')
            .attr('stroke', d => LAYER_COLORS[d.layer])
            .attr('stroke-width', 2);

          mn.append('text')
            .attr('text-anchor', 'middle')
            .attr('fill', '#f1f5f9')
            .attr('font', '700 13px Outfit')
            .attr('x', 80)
            .attr('y', 28)
            .text(d => d.label);

          mn.append('text')
            .attr('text-anchor', 'middle')
            .attr('fill', '#94a3b8')
            .attr('font', '400 11px Outfit')
            .attr('opacity', 0.7)
            .attr('x', 80)
            .attr('y', 48)
            .text(d => d.count + ' modules');
        }

        // Fit on load
        const cRect = container.getBoundingClientRect();
        const scaleX = cRect.width / (canvasW + 120);
        const scaleY = cRect.height / (totalHeight + 120);
        const initScale = Math.min(scaleX, scaleY, 1);
        const tx = (cRect.width - canvasW * initScale) / 2;
        const ty = 20;
        svg.call(d3zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(initScale));

        // Auto-macro for large projects
        if (graphData.nodes.length > 50) {
          window.toggleMacroView();
        }
      `,
    };
  }
}
