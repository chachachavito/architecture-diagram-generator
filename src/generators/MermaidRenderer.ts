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

    // Group by Layer -> Domain
    const layers = this.groupData(snapshot);
    const sortedLayers = Array.from(layers.keys()).sort();

    for (const layerName of sortedLayers) {
      const domains = layers.get(layerName)!;
      output += `  subgraph ${layerName}\n`;
      
      for (const [domainName, nodes] of domains.entries()) {
        const hasDomain = domainName !== 'shared' && domainName !== '';
        if (hasDomain) {
          output += `    subgraph ${layerName}_${this.safeId(domainName)} ["${domainName}"]\n`;
        }
        
        for (const node of nodes) {
          const token = visualTokens.get(node.id);
          const label = this.escapeLabel(token?.label || node.id);
          const icon = token?.icon ? `${token.icon} ` : '';
          output += `      ${this.safeId(node.id)}["${icon}${label}"]\n`;
        }

        if (hasDomain) {
          output += '    end\n';
        }
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

  private groupData(snapshot: GraphSnapshot): Map<string, Map<string, any[]>> {
    const layers = new Map<string, Map<string, any[]>>();
    
    for (const node of snapshot.nodes) {
      const layer = node.metadata.layer || 'Core';
      const domain = node.metadata.domain || 'shared';
      
      if (!layers.has(layer)) layers.set(layer, new Map());
      const domains = layers.get(layer)!;
      
      if (!domains.has(domain)) domains.set(domain, []);
      domains.get(domain)!.push(node);
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
