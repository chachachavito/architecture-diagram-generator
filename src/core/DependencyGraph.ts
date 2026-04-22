import { 
  GraphNode, 
  GraphEdge, 
  SourceGraph, 
  ClassifiedGraph, 
  GraphSnapshot,
  NodeType,
  ArchitectureLayer
} from './GraphTypes';

export { 
  GraphNode, 
  GraphEdge, 
  SourceGraph, 
  ClassifiedGraph, 
  GraphSnapshot,
  NodeType,
  ArchitectureLayer
};

/**
 * Utility to deeply freeze an object
 */
export function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Handle recursion protection for circular references if needed, 
  // but for graph snapshots we expect tree-like or controlled DAG structures.
  // Using a simple recursion for now as per requirements.
  
  const propNames = Object.getOwnPropertyNames(obj);
  for (const name of propNames) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (obj as any)[name];
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }

  return Object.freeze(obj);
}

/**
 * DependencyGraph class provides storage for nodes and edges
 * with methods to add and query graph elements.
 */
export class DependencyGraph {
  nodes: Map<string, GraphNode> = new Map();
  edges: GraphEdge[] = [];

  /**
   * Adds a node to the graph. If a node with the same ID already exists,
   * it will be overwritten.
   */
  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  /**
   * Adds a directed edge to the graph.
   * Duplicate edges (same from/to/type) are not added.
   */
  addEdge(edge: GraphEdge): void {
    const isDuplicate = this.edges.some(
      (e) => e.from === edge.from && e.to === edge.to && e.type === edge.type
    );
    if (!isDuplicate) {
      this.edges.push(edge);
    }
  }

  /**
   * Returns whether a node with the given ID exists in the graph.
   */
  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  /**
   * Returns the node with the given ID, or undefined if not found.
   */
  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Returns all edges originating from the given node ID.
   */
  getEdgesFrom(fromId: string): GraphEdge[] {
    return this.edges.filter((e) => e.from === fromId);
  }

  /**
   * Returns all edges pointing to the given node ID.
   */
  getEdgesTo(toId: string): GraphEdge[] {
    return this.edges.filter((e) => e.to === toId);
  }

  /**
   * Sorts nodes and edges deterministically.
   */
  sort(): void {
    // Edges are sorted in place
    this.edges.sort((a, b) => {
      const fromCmp = a.from.localeCompare(b.from);
      if (fromCmp !== 0) return fromCmp;
      return a.to.localeCompare(b.to);
    });
  }

  /**
   * Creates a deeply frozen snapshot of the graph.
   */
  createSnapshot(version: string): GraphSnapshot {
    this.sort();
    const classified: ClassifiedGraph = {
      nodes: Array.from(this.nodes.values()).sort((a, b) => a.id.localeCompare(b.id)),
      edges: JSON.parse(JSON.stringify(this.edges)),
      version
    };
    return deepFreeze(classified);
  }
}
