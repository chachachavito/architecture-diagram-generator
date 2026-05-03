import { ClassifiedGraph, NodeType } from '../core/GraphTypes';

export interface VisualToken {
  nodeId: string;
  severityColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  icon?: string;
  label: string;
  color: string;
  shape: 'rectangle' | 'hexagon' | 'cylinder' | 'rounded' | 'parallelogram';
}

/**
 * VisualMapper converts architectural data into visual presentation tokens.
 */
export class VisualMapper {
  private readonly colors = {
    UI: '#38bdf8',       // Blue
    API: '#34d399',      // Emerald
    Action: '#f472b6',   // Pink
    Service: '#818cf8',  // Indigo
    Core: '#94a3b8',     // Slate
    External: '#fbbf24', // Amber
    shared: '#64748b'    // Gray
  };

  /**
   * Maps a graph to visual tokens
   */
  map(graph: ClassifiedGraph): Map<string, VisualToken> {
    const tokens = new Map<string, VisualToken>();

    for (const node of graph.nodes) {
      const layer = node.metadata.layer || 'Core';
      const type = node.metadata.type || 'module';
      
      tokens.set(node.id, {
        nodeId: node.id,
        borderStyle: 'solid',
        icon: this.getIconForType(type),
        label: node.metadata.label || node.id,
        color: this.colors[layer as keyof typeof this.colors] || this.colors.Core,
        shape: this.getShapeForType(type)
      });
    }

    return tokens;
  }

  private getIconForType(type: NodeType): string {
    switch (type) {
      case 'api': return '🌐';
      case 'service': return '⚙️';
      case 'module': return '📦';
      case 'external': return '☁️';
      default: return '📄';
    }
  }

  private getShapeForType(type: NodeType): VisualToken['shape'] {
    switch (type) {
      case 'api': return 'hexagon';
      case 'service': return 'rounded';
      case 'external': return 'cylinder';
      default: return 'rectangle';
    }
  }
}
