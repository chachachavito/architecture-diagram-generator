import { ExternalCall } from '../parsers';

/**
 * Type definitions for nodes and edges
 */
export type NodeType = 'route' | 'api' | 'component' | 'utility' | 'config' | 'external-service';
export type ArchitectureLayer = 'UI' | 'API' | 'Processing' | 'Data' | 'Storage';
export type EdgeType = 'import' | 'external-call';

/**
 * Interface representing a node in the dependency graph
 */
export interface GraphNode {
  id: string;                    // File path (unique identifier)
  type: NodeType;                // Type of node
  layer?: ArchitectureLayer;     // Architecture layer classification
  domain?: string;               // Domain grouping
  externalCalls: ExternalCall[]; // External API/service calls made by this module
  label?: string;                // Optional display label
}

/**
 * Interface representing a directed edge in the dependency graph
 */
export interface GraphEdge {
  from: string;   // Source node ID
  to: string;     // Target node ID
  type: EdgeType; // Relationship type
}

/**
 * DependencyGraph class provides Map-based storage for nodes and edges
 * with methods to add and query graph elements.
 */
export class DependencyGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];

  constructor() {
    this.nodes = new Map<string, GraphNode>();
    this.edges = [];
  }

  /**
   * Adds a node to the graph. If a node with the same ID already exists,
   * it will be overwritten.
   * @param node - GraphNode to add
   */
  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  /**
   * Adds a directed edge to the graph.
   * Duplicate edges (same from/to/type) are not added.
   * @param edge - GraphEdge to add
   */
  addEdge(edge: GraphEdge): void {
    // Avoid duplicate edges
    const isDuplicate = this.edges.some(
      (e) => e.from === edge.from && e.to === edge.to && e.type === edge.type
    );
    if (!isDuplicate) {
      this.edges.push(edge);
    }
  }

  /**
   * Returns whether a node with the given ID exists in the graph.
   * @param id - Node ID to check
   */
  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  /**
   * Returns the node with the given ID, or undefined if not found.
   * @param id - Node ID to retrieve
   */
  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Returns all edges originating from the given node ID.
   * @param fromId - Source node ID
   */
  getEdgesFrom(fromId: string): GraphEdge[] {
    return this.edges.filter((e) => e.from === fromId);
  }

  /**
   * Returns all edges pointing to the given node ID.
   * @param toId - Target node ID
   */
  getEdgesTo(toId: string): GraphEdge[] {
    return this.edges.filter((e) => e.to === toId);
  }
}
