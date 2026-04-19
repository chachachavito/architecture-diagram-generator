import fs from 'fs/promises';
import path from 'path';
import { DependencyGraph } from './DependencyGraph';
import type { GraphNode, GraphEdge } from './DependencyGraph';
import type { ClassifiedGraph } from './ArchitectureClassifier';
import type { MermaidDiagram } from '../generators';

// ─── Metadata Types ───────────────────────────────────────────────────────────

/**
 * Statistics about the analyzed architecture.
 */
export interface ArchitectureMetadata {
  /** Total number of nodes in the graph */
  nodeCount: number;
  
  /** Total number of edges in the graph */
  edgeCount: number;
  
  /** Number of nodes per layer */
  layerCounts: Record<string, number>;
  
  /** Number of nodes per domain */
  domainCounts: Record<string, number>;
  
  /** List of detected layers */
  layers: string[];
  
  /** List of detected domains */
  domains: string[];
  
  /** List of detected external services */
  externalServices: string[];
  
  /** Timestamp when the analysis was generated */
  generatedAt: string;
  
  /** Version of the generator */
  generatorVersion: string;
  
  /** Project root directory */
  rootDir: string;
  
  /** Configuration file used (if any) */
  configFile?: string;
}

/**
 * Change detection result between two graph versions.
 */
export interface ChangeDetectionResult {
  /** Nodes added since last version */
  addedNodes: string[];
  
  /** Nodes removed since last version */
  removedNodes: string[];
  
  /** Nodes that exist in both but may have changed */
  modifiedNodes: NodeModification[];
  
  /** Edges added since last version */
  addedEdges: EdgeChange[];
  
  /** Edges removed since last version */
  removedEdges: EdgeChange[];
  
  /** Summary statistics */
  summary: {
    totalChanges: number;
    addedCount: number;
    removedCount: number;
    modifiedCount: number;
  };
  
  /** Timestamp of comparison */
  comparedAt: string;
}

/**
 * Details about a modified node.
 */
export interface NodeModification {
  /** Node ID */
  nodeId: string;
  
  /** Previous state */
  previous: {
    layer?: string;
    domain?: string;
    type?: string;
  };
  
  /** Current state */
  current: {
    layer?: string;
    domain?: string;
    type?: string;
  };
  
  /** What changed */
  changes: string[];
}

/**
 * Represents an edge change (addition or removal).
 */
export interface EdgeChange {
  from: string;
  to: string;
  type: string;
}

// ─── Metadata Generator ───────────────────────────────────────────────────────

/**
 * Generates metadata about the analyzed architecture.
 * 
 * Requirements: 9.3
 */
export class MetadataGenerator {
  private readonly generatorVersion = '1.0.0';

  /**
   * Generates metadata from a classified graph.
   * 
   * @param graph - The classified dependency graph
   * @param rootDir - Project root directory
   * @param configFile - Optional config file path
   */
  generate(
    graph: ClassifiedGraph | DependencyGraph,
    rootDir: string = './',
    configFile?: string
  ): ArchitectureMetadata {
    const nodes: GraphNode[] = graph.nodes instanceof Map 
      ? Array.from(graph.nodes.values()) 
      : graph.nodes;
    const edges = graph.edges;

    // Count by layer
    const layerCounts: Record<string, number> = {};
    const layers = new Set<string>();
    
    // Infer layers from nodes
    for (const node of nodes) {
      const layer = node.layer || node.metadata?.layer;
      if (layer) {
        layers.add(layer);
        layerCounts[layer] = (layerCounts[layer] || 0) + 1;
      }
    }

    // Count by domain
    const domainCounts: Record<string, number> = {};
    const domains = new Set<string>();
    
    // Infer domains from nodes
    for (const node of nodes) {
      const domain = node.domain || node.metadata?.domain;
      if (domain) {
        domains.add(domain);
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      }
    }

    // Extract external services
    const externalServices = nodes
      .filter(n => (n.type || n.metadata?.type) === 'external')
      .map(n => n.id);

    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      layerCounts,
      domainCounts,
      layers: Array.from(layers),
      domains: Array.from(domains),
      externalServices,
      generatedAt: new Date().toISOString(),
      generatorVersion: this.generatorVersion,
      rootDir,
      configFile,
    };
  }

  /**
   * Generates metadata from a Mermaid diagram.
   * 
   * @param diagram - The generated Mermaid diagram
   */
  generateFromDiagram(diagram: MermaidDiagram): ArchitectureMetadata {
    return {
      nodeCount: diagram.metadata.nodeCount,
      edgeCount: diagram.metadata.edgeCount,
      layerCounts: {},
      domainCounts: {},
      layers: diagram.metadata.layers || [],
      domains: diagram.metadata.domains || [],
      externalServices: diagram.metadata.externalServices || [],
      generatedAt: diagram.metadata.generatedAt.toISOString(),
      generatorVersion: this.generatorVersion,
      rootDir: './',
    };
  }

  /**
   * Saves metadata to a JSON file.
   * 
   * @param metadata - The metadata to save
   * @param outputPath - Path to save the metadata file
   */
  async saveToFile(metadata: ArchitectureMetadata, outputPath: string): Promise<void> {
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(metadata, null, 2), 'utf-8');
  }

  /**
   * Loads metadata from a JSON file.
   * 
   * @param inputPath - Path to the metadata file
   */
  async loadFromFile(inputPath: string): Promise<ArchitectureMetadata | null> {
    try {
      const content = await fs.readFile(inputPath, 'utf-8');
      return JSON.parse(content) as ArchitectureMetadata;
    } catch {
      return null;
    }
  }
}

// ─── Change Detector ──────────────────────────────────────────────────────────

/**
 * Detects changes between two versions of the architecture graph.
 * 
 * Requirements: 9.4, 9.5
 */
export class ChangeDetector {
  /**
   * Compares two graphs and detects changes.
   * 
   * @param current - Current graph version
   * @param previous - Previous graph version (can be loaded from metadata)
   */
  detect(
    current: ClassifiedGraph | DependencyGraph,
    previous: ClassifiedGraph | DependencyGraph
  ): ChangeDetectionResult {
    const currentNodes = current.nodes instanceof Map 
      ? current.nodes 
      : new Map(current.nodes.map(n => [n.id, n]));
    const previousNodes = previous.nodes instanceof Map 
      ? previous.nodes 
      : new Map(previous.nodes.map(n => [n.id, n]));

    const addedNodes: string[] = [];
    const removedNodes: string[] = [];
    const modifiedNodes: NodeModification[] = [];

    // Find added and modified nodes
    for (const [id, node] of currentNodes) {
      if (!previousNodes.has(id)) {
        addedNodes.push(id);
      } else {
        const prevNode = previousNodes.get(id)!;
        const changes = this.detectNodeChanges(node, prevNode);
        if (changes.length > 0) {
          modifiedNodes.push({
            nodeId: id,
            previous: {
              layer: prevNode.layer,
              domain: prevNode.domain,
              type: prevNode.type,
            },
            current: {
              layer: node.layer,
              domain: node.domain,
              type: node.type,
            },
            changes,
          });
        }
      }
    }

    // Find removed nodes
    for (const id of previousNodes.keys()) {
      if (!currentNodes.has(id)) {
        removedNodes.push(id);
      }
    }

    // Detect edge changes
    const currentEdges = this.edgesToSet(current.edges);
    const previousEdges = this.edgesToSet(previous.edges);

    const addedEdges: EdgeChange[] = [];
    const removedEdges: EdgeChange[] = [];

    for (const edgeKey of currentEdges.keys()) {
      if (!previousEdges.has(edgeKey)) {
        const edge = currentEdges.get(edgeKey)!;
        addedEdges.push({
          from: edge.from,
          to: edge.to,
          type: edge.type,
        });
      }
    }

    for (const edgeKey of previousEdges.keys()) {
      if (!currentEdges.has(edgeKey)) {
        const edge = previousEdges.get(edgeKey)!;
        removedEdges.push({
          from: edge.from,
          to: edge.to,
          type: edge.type,
        });
      }
    }

    const totalChanges = addedNodes.length + removedNodes.length + 
                         modifiedNodes.length + addedEdges.length + removedEdges.length;

    return {
      addedNodes,
      removedNodes,
      modifiedNodes,
      addedEdges,
      removedEdges,
      summary: {
        totalChanges,
        addedCount: addedNodes.length + addedEdges.length,
        removedCount: removedNodes.length + removedEdges.length,
        modifiedCount: modifiedNodes.length,
      },
      comparedAt: new Date().toISOString(),
    };
  }

  /**
   * Compares current graph with a previously saved metadata file.
   * 
   * @param current - Current graph version
   * @param metadataPath - Path to the previous metadata file
   */
  async detectFromMetadata(
    current: ClassifiedGraph | DependencyGraph,
    metadataPath: string
  ): Promise<ChangeDetectionResult | null> {
    const generator = new MetadataGenerator();
    const previousMetadata = await generator.loadFromFile(metadataPath);
    
    if (!previousMetadata) {
      return null;
    }

    // Reconstruct a minimal previous graph from metadata
    // Note: This is a simplified comparison since we don't have full graph data
    const previousGraph = new DependencyGraph();

    // We can only do limited comparison without full graph data
    // Return a summary-based comparison
    const currentMetadata = generator.generate(current);
    
    return {
      addedNodes: [],
      removedNodes: [],
      modifiedNodes: [],
      addedEdges: [],
      removedEdges: [],
      summary: {
        totalChanges: Math.abs(currentMetadata.nodeCount - previousMetadata.nodeCount) +
                       Math.abs(currentMetadata.edgeCount - previousMetadata.edgeCount),
        addedCount: Math.max(0, currentMetadata.nodeCount - previousMetadata.nodeCount),
        removedCount: Math.max(0, previousMetadata.nodeCount - currentMetadata.nodeCount),
        modifiedCount: 0,
      },
      comparedAt: new Date().toISOString(),
    };
  }

  /**
   * Saves the current graph state for future comparison.
   * 
   * @param graph - The graph to save
   * @param outputPath - Path to save the graph state
   */
  async saveGraphState(
    graph: ClassifiedGraph | DependencyGraph,
    outputPath: string
  ): Promise<void> {
    const state = {
      nodes: (graph.nodes instanceof Map ? Array.from(graph.nodes.values()) : graph.nodes).map((node) => ({
        id: node.id,
        type: node.type || node.metadata?.type,
        layer: node.layer || node.metadata?.layer,
        domain: node.domain || node.metadata?.domain,
      })),
      edges: graph.edges.map((e: any) => ({
        from: e.from,
        to: e.to,
        type: e.type,
      })),
      savedAt: new Date().toISOString(),
    };

    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(state, null, 2), 'utf-8');
  }

  /**
   * Loads a previously saved graph state.
   * 
   * @param inputPath - Path to the saved graph state
   */
  async loadGraphState(inputPath: string): Promise<DependencyGraph | null> {
    try {
      const content = await fs.readFile(inputPath, 'utf-8');
      const state = JSON.parse(content);
      
      const edges: GraphEdge[] = state.edges.map((e: { from: string; to: string; type: string }) => ({
        from: e.from,
        to: e.to,
        type: e.type,
      }));

      const graph = new DependencyGraph();
      for (const node of state.nodes) {
        graph.addNode({
          id: node.id,
          metadata: {
            type: node.type,
            layer: node.layer,
            domain: node.domain,
            source: 'inferred'
          },
          type: node.type,
          layer: node.layer,
          domain: node.domain,
          externalCalls: [],
        });
      }
      graph.edges = edges;
      return graph;
    } catch {
      return null;
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private detectNodeChanges(current: GraphNode, previous: GraphNode): string[] {
    const changes: string[] = [];

    if (current.layer !== previous.layer) {
      changes.push(`layer: ${previous.layer} → ${current.layer}`);
    }

    if (current.domain !== previous.domain) {
      changes.push(`domain: ${previous.domain} → ${current.domain}`);
    }

    if (current.type !== previous.type) {
      changes.push(`type: ${previous.type} → ${current.type}`);
    }

    return changes;
  }

  private edgesToSet(edges: GraphEdge[]): Map<string, GraphEdge> {
    const map = new Map<string, GraphEdge>();
    for (const edge of edges) {
      const key = `${edge.from}->${edge.to}:${edge.type}`;
      map.set(key, edge);
    }
    return map;
  }
}

// ─── Change Highlighter ────────────────────────────────────────────────────────

/**
 * Highlights changes in Mermaid diagrams.
 * Optional feature for visual change indication.
 */
export class ChangeHighlighter {
  /**
   * Applies highlighting styles to a Mermaid diagram based on changes.
   * 
   * @param mermaidSyntax - Original Mermaid syntax
   * @param changes - Detected changes
   */
  highlight(mermaidSyntax: string, changes: ChangeDetectionResult): string {
    const lines = mermaidSyntax.split('\n');
    const highlightedLines: string[] = [];

    // Build lookup sets for node IDs in various formats
    const addedNodeIds = new Set(changes.addedNodes);
    const removedNodeIds = new Set(changes.removedNodes);
    const modifiedNodeIds = new Set(changes.modifiedNodes.map(m => m.nodeId));

    for (const line of lines) {
      let highlighted = line;

      // Check if this line contains any of the changed nodes
      // Node IDs in Mermaid are sanitized (special chars replaced with underscores)
      for (const nodeId of addedNodeIds) {
        if (this.lineContainsNode(line, nodeId)) {
          highlighted = this.applyAddedStyle(line);
          break;
        }
      }

      if (highlighted === line) {
        for (const nodeId of removedNodeIds) {
          if (this.lineContainsNode(line, nodeId)) {
            highlighted = `%% REMOVED: ${line}`;
            break;
          }
        }
      }

      if (highlighted === line) {
        for (const nodeId of modifiedNodeIds) {
          if (this.lineContainsNode(line, nodeId)) {
            highlighted = this.applyModifiedStyle(line);
            break;
          }
        }
      }

      highlightedLines.push(highlighted);
    }

    // Add legend for changes
    if (changes.summary.totalChanges > 0) {
      highlightedLines.unshift('%% === Architecture Changes ===');
      highlightedLines.unshift(`%% Added: ${changes.summary.addedCount}`);
      highlightedLines.unshift(`%% Removed: ${changes.summary.removedCount}`);
      highlightedLines.unshift(`%% Modified: ${changes.summary.modifiedCount}`);
      highlightedLines.unshift('%% ============================');
    }

    return highlightedLines.join('\n');
  }

  /**
   * Checks if a line contains a reference to a node.
   * Handles both raw node IDs and sanitized Mermaid IDs.
   */
  private lineContainsNode(line: string, nodeId: string): boolean {
    const sanitizedId = this.sanitizeForMermaid(nodeId);
    
    // Check for node definition: nodeId[Label] or nodeId(Label) etc.
    // The node ID appears at the start of a node definition
    const nodeDefPattern = new RegExp(`\\b${this.escapeRegex(sanitizedId)}\\s*[\\[\\(\\{]`, 'g');
    if (nodeDefPattern.test(line)) {
      return true;
    }
    
    // Check for edge reference: A --> B (nodeId could be A or B)
    const edgePattern = new RegExp(`\\b${this.escapeRegex(sanitizedId)}\\b`);
    if (edgePattern.test(line)) {
      return true;
    }
    
    return false;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private sanitizeForMermaid(id: string): string {
    // Match the sanitization used in DiagramGenerator
    return id.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  private applyAddedStyle(line: string): string {
    // Add green background style for added nodes
    return line + ' %% ADDED';
  }

  private applyModifiedStyle(line: string): string {
    // Add yellow background style for modified nodes
    return line + ' %% MODIFIED';
  }
}
