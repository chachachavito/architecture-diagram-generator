import path from 'path';
import { SourceGraph } from './GraphTypes';

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
    // Resolve absolute paths relative to rootDir
    let normalized = filePath;
    if (path.isAbsolute(normalized) && rootDir) {
      normalized = path.relative(rootDir, normalized);
    }
    // Collapse any '..' or '.' segments
    normalized = path.normalize(normalized);
    // Force forward slashes
    normalized = normalized.replace(/\\/g, '/');
    // Remove leading './' or '/' and any leading '../'
    normalized = normalized.replace(/^(\.|\/)*/, '');
    // Ensure no leftover '../' segments
    normalized = normalized.split('/').filter(seg => seg !== '..').join('/');
    return normalized;
  }

  private createLabel(normalizedId: string): string {
    const parts = normalizedId.split('/');
    const basename = parts[parts.length - 1];
    // Remove extension
    const nameWithoutExt = basename.replace(/\.(ts|tsx|js|jsx|css|scss|md)$/, '');
    
    let label = nameWithoutExt;

    // List of generic names that need context
    const genericNames = [
      'index', 'page', 'route', 'layout', 'styles', 'template', 
      'loading', 'error', 'not-found', 'component', 'view', 'controller', 'service'
    ];

    if (genericNames.includes(nameWithoutExt.toLowerCase()) && parts.length > 1) {
      // Take up to 2 context parts + the filename
      const contextParts = parts.slice(Math.max(0, parts.length - 3), parts.length - 1);
      label = [...contextParts, nameWithoutExt].join(' / ');
    }
    
    // Convert kebab-case or snake_case to Space Case and Title Case
    return label
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .replace(/\s+\/\s+/g, ' / ') // Ensure clean separators
      .trim();
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
