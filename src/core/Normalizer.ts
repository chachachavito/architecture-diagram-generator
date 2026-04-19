import path from 'path';
import { SourceGraph, ClassifiedGraph } from './GraphTypes';

/**
 * Normalizer handles path normalization and label creation.
 * Idempotent: running twice on the same data should yield the same result.
 */
export class Normalizer {
  private pathMap: Map<string, string> = new Map();

  /**
   * Normalizes the graph data
   */
  normalize(graph: SourceGraph, rootDir: string = ''): SourceGraph {
    this.pathMap.clear();

    const normalizedNodes = graph.nodes.map(node => {
      const normalizedId = this.normalizePath(node.id, rootDir);
      this.pathMap.set(node.id, normalizedId);
      
      return {
        ...node,
        id: normalizedId,
        metadata: {
          ...node.metadata,
          label: node.metadata.label || this.createLabel(normalizedId)
        }
      };
    });

    const normalizedEdges = graph.edges.map(edge => ({
      ...edge,
      id: `${this.pathMap.get(edge.from) || edge.from}->${this.pathMap.get(edge.to) || edge.to}:${edge.type}`,
      from: this.pathMap.get(edge.from) || edge.from,
      to: this.pathMap.get(edge.to) || edge.to
    }));

    return {
      nodes: normalizedNodes,
      edges: normalizedEdges
    };
  }

  private normalizePath(filePath: string, rootDir: string): string {
    // If it's an absolute path and we have a rootDir, make it relative
    let normalized = filePath;
    if (path.isAbsolute(normalized) && rootDir) {
      normalized = path.relative(rootDir, normalized);
    }
    
    // Force forward slashes
    normalized = normalized.replace(/\\/g, '/');
    
    // Remove leading ./ or /
    normalized = normalized.replace(/^(\.\/|\/)/, '');
    
    return normalized;
  }

  private createLabel(normalizedId: string): string {
    const parts = normalizedId.split('/');
    const basename = parts[parts.length - 1];
    const nameWithoutExt = basename.replace(/\.(ts|tsx|js|jsx)$/, '');
    
    let label = nameWithoutExt;

    // If generic name, use parent directory for context
    const genericNames = ['index', 'page', 'route', 'layout', 'styles'];
    if (genericNames.includes(nameWithoutExt.toLowerCase()) && parts.length > 1) {
      const parentDir = parts[parts.length - 2];
      label = `${parentDir}/${nameWithoutExt}`;
    }
    
    // Convert kebab-case or snake_case to Space Case
    return label
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Returns the original path for a normalized ID
   */
  getOriginalPath(normalizedId: string): string | undefined {
    for (const [original, normalized] of this.pathMap.entries()) {
      if (normalized === normalizedId) return original;
    }
    return undefined;
  }
}
