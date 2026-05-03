import { GraphSnapshot, GraphNode } from '../core/GraphTypes';
import { VisualToken } from './VisualMapper';

/**
 * MermaidRenderer generates deterministic Mermaid syntax from architectural data.
 */
export class MermaidRenderer {
  /**
   * Renders the graph into Mermaid flowchart syntax
   */
  render(snapshot: GraphSnapshot, visualTokens: Map<string, VisualToken>, options: { simplified?: boolean } = {}): string {
    return options.simplified 
      ? this.renderSimplified(snapshot)
      : this.renderDetailed(snapshot, visualTokens);
  }

  private renderDetailed(snapshot: GraphSnapshot, visualTokens: Map<string, VisualToken>): string {
    let output = 'flowchart TD\n';

    // Group by Layer -> Domain
    const layers = this.groupData(snapshot);
    const sortedLayers = Array.from(layers.keys()).sort();

    for (const layerName of sortedLayers) {
      const domains = layers.get(layerName)!;
      const safeLayerId = this.safeId(layerName);
      output += `  subgraph ${safeLayerId} ["${this.escapeLabel(layerName)}"]\n`;
      
      for (const [domainName, nodes] of domains.entries()) {
        const hasDomain = domainName !== 'shared' && domainName !== '';
        if (hasDomain) {
          const safeDomainId = this.safeId(layerName + '_' + domainName);
          output += `    subgraph ${safeDomainId} ["${this.escapeLabel(domainName)}"]\n`;
        }
        
        for (const node of nodes) {
          const token = visualTokens.get(node.id)!;
          const label = this.escapeLabel(token.label);
          const icon = token.icon ? `${token.icon} ` : '';
          const shape = this.getMermaidShape(token.shape, `${icon}${label}`);
          output += `      ${this.safeId(node.id)}${shape}\n`;
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
      const color = token.severityColor || token.color;
      const width = token.severityColor ? '4px' : '1px';
      output += `  style ${this.safeId(token.nodeId)} fill:${token.color}22,stroke:${color},stroke-width:${width}\n`;
    }

    return output;
  }

  private getMermaidShape(shape: VisualToken['shape'], label: string): string {
    switch (shape) {
      case 'hexagon': return `{{ "${label}" }}`;
      case 'rounded': return `([ "${label}" ])`;
      case 'cylinder': return `[( "${label}" )]`;
      case 'parallelogram': return `[/ "${label}" /]`;
      default: return `["${label}"]`;
    }
  }

  private renderSimplified(snapshot: GraphSnapshot): string {
    let output = 'flowchart TD\n';
    
    // Nodes: One per Domain per Layer
    const layers = this.groupData(snapshot);
    for (const [layerName, domains] of layers.entries()) {
      output += `  subgraph ${this.safeId(layerName)}\n`;
      for (const [domainName, nodes] of domains.entries()) {
        const count = nodes.length;
        const label = count > 0 ? `${domainName} (${count} files)` : domainName;
        output += `    ${this.safeId(layerName + '_' + domainName)}["${this.escapeLabel(label)}"]\n`;
      }
      output += '  end\n';
    }

    // Edges: Aggregate file edges to domain edges
    const domainEdges = new Set<string>();
    for (const edge of snapshot.edges) {
      const fromNode = snapshot.nodes.find(n => n.id === edge.from);
      const toNode = snapshot.nodes.find(n => n.id === edge.to);
      
      if (fromNode && toNode) {
        const fromDomain = `${this.safeId(fromNode.metadata.layer || 'Core')}_${this.safeId(fromNode.metadata.domain || 'shared')}`;
        const toDomain = `${this.safeId(toNode.metadata.layer || 'Core')}_${this.safeId(toNode.metadata.domain || 'shared')}`;
        
        if (fromDomain !== toDomain) {
          domainEdges.add(`${fromDomain} --> ${toDomain}`);
        }
      }
    }

    for (const edgeString of domainEdges) {
      output += `  ${edgeString}\n`;
    }

    return output;
  }

  private groupData(snapshot: GraphSnapshot): Map<string, Map<string, GraphNode[]>> {
    const layers = new Map<string, Map<string, GraphNode[]>>();
    
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
    // Remove all characters that commonly break Mermaid syntax
    return label
      .replace(/"/g, '#quot;')
      .replace(/[[\](){}]/g, '')
      .replace(/[<>|]/g, '')
      .replace(/--+/g, '-')
      .trim();
  }
}
