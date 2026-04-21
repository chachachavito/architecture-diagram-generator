import { ClassifiedGraph, NodeType } from '../core/GraphTypes';

export interface VisualToken {
  nodeId: string;
  severityColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  icon?: string;
  label: string;
}

/**
 * VisualMapper converts architectural data into visual presentation tokens.
 */
export class VisualMapper {
  /**
   * Maps a graph to visual tokens
   */
  map(graph: ClassifiedGraph): Map<string, VisualToken> {
    const tokens = new Map<string, VisualToken>();

    for (const node of graph.nodes) {
      tokens.set(node.id, {
        nodeId: node.id,
        borderStyle: 'solid',
        icon: this.getIconForType(node.metadata.type),
        label: node.metadata.label || node.id
      });
    }

    return tokens;
  }

  private getIconForType(type: NodeType): string {
    // Emojis removed for professional tone
    switch (type) {
      case 'api': return '[API]';
      case 'service': return '[SVC]';
      case 'module': return '[MOD]';
      case 'external': return '[EXT]';
      default: return '[FILE]';
    }
  }
}
