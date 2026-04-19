import { ClassifiedGraph, Issue, NodeType, ArchitectureLayer } from '../core/GraphTypes';

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
   * Maps a graph and its issues to visual tokens
   */
  map(graph: ClassifiedGraph, issues: Issue[]): Map<string, VisualToken> {
    const tokens = new Map<string, VisualToken>();

    for (const node of graph.nodes) {
      const nodeIssues = issues.filter(i => i.nodeId === node.id);
      const maxSeverity = this.getMaxSeverity(nodeIssues);
      
      tokens.set(node.id, {
        nodeId: node.id,
        severityColor: this.getColorForSeverity(maxSeverity),
        borderStyle: maxSeverity ? 'solid' : 'dotted',
        icon: this.getIconForType(node.metadata.type),
        label: node.metadata.label || node.id
      });
    }

    return tokens;
  }

  private getMaxSeverity(issues: Issue[]): string | undefined {
    if (issues.length === 0) return undefined;
    
    const severityOrder = ['critical', 'high', 'medium', 'low'];
    for (const s of severityOrder) {
      if (issues.some(i => i.severity === s)) return s;
    }
    return 'low';
  }

  private getColorForSeverity(severity?: string): string | undefined {
    switch (severity) {
      case 'critical': return '#ff0000';
      case 'high': return '#ff6600';
      case 'medium': return '#ffcc00';
      case 'low': return '#ffff00';
      default: return undefined;
    }
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
}
