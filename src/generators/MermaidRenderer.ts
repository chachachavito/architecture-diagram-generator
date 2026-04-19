import { ClassifiedGraph, GraphSnapshot } from '../core/GraphTypes';
import { VisualToken } from './VisualMapper';

/**
 * MermaidRenderer generates deterministic Mermaid syntax from architectural data.
 */
export class MermaidRenderer {
  /**
   * Renders the graph into Mermaid flowchart syntax
   */
  render(snapshot: GraphSnapshot, visualTokens: Map<string, VisualToken>): string {
    let output = '%%{init: {"maxTextSize": 1000000}}%%\n';
    output += 'flowchart TD\n';

    // Group by Layer
    const layers = this.groupByLayer(snapshot);
    const sortedLayers = Array.from(layers.keys()).sort();

    for (const layerName of sortedLayers) {
      const nodes = layers.get(layerName)!;
      output += `  subgraph ${layerName}\n`;
      for (const node of nodes) {
        const token = visualTokens.get(node.id);
        const label = this.escapeLabel(token?.label || node.id);
        const icon = token?.icon ? `${token.icon} ` : '';
        output += `    ${this.safeId(node.id)}["${icon}${label}"]\n`;
      }
      output += '  end\n';
    }

    // Render Edges
    for (const edge of snapshot.edges) {
      output += `  ${this.safeId(edge.from)} --> ${this.safeId(edge.to)}\n`;
    }

    // Apply Styles
    for (const token of visualTokens.values()) {
      if (token.severityColor) {
        output += `  style ${this.safeId(token.nodeId)} stroke:${token.severityColor},stroke-width:4px\n`;
      }
    }

    return output;
  }

  private groupByLayer(snapshot: GraphSnapshot): Map<string, any[]> {
    const layers = new Map<string, any[]>();
    for (const node of snapshot.nodes) {
      const layer = node.metadata.layer || 'Other';
      if (!layers.has(layer)) layers.set(layer, []);
      layers.get(layer)!.push(node);
    }
    return layers;
  }

  private safeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9]/g, '_');
  }

  private escapeLabel(label: string): string {
    return label.replace(/"/g, '#quot;');
  }
}
