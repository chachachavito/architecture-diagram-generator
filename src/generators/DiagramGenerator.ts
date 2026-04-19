import { ParsedModule } from '../parsers';

import { ClassifiedGraph, DependencyGraph, ArchitectureLayer, GraphNode, GraphEdge, NodeType, EdgeType } from '../core';

/**
 * Interface for diagram generation options
 */
export interface GenerationOptions {
  direction?: 'TB' | 'LR' | 'BT' | 'RL';  // Graph direction
  includeExternalServices?: boolean;
  groupByLayer?: boolean;
  showDependencies?: boolean;
  maxNodes?: number;                       // Limit total nodes
  maxNodesPerLayer?: number;              // Limit nodes per layer
}

/**
 * Interface representing generated Mermaid diagram
 */
export interface MermaidDiagram {
  syntax: string;
  metadata: DiagramMetadata;
  extraContent?: string;
}

/**
 * Interface for diagram metadata
 */
export interface DiagramMetadata {
  nodeCount: number;
  edgeCount: number;
  generatedAt: Date;
  layers?: ArchitectureLayer[];
  domains?: string[];
  externalServices?: string[];
}

/**
 * DiagramGenerator class generates Mermaid syntax from a dependency graph
 */
export class DiagramGenerator {
  /**
   * Generates a simplified Mermaid diagram with aggregated modules by layer and domain.
   * Shows only high-level components (20-30 nodes) and connections between layers.
   * @param graph - Dependency graph (or ClassifiedGraph) to visualize
   * @param options - Generation options
   * @returns MermaidDiagram - Generated simplified diagram with metadata
   */
  generateSimplified(graph: DependencyGraph | ClassifiedGraph, options: GenerationOptions = {}): MermaidDiagram {
    const direction = options.direction || 'LR';
    
    // Validate direction
    this.validateDirection(direction);

    // Build Mermaid syntax
    const lines: string[] = [];
    
    // Add init block
    lines.push('%%{init: {"flowchart": {"nodeSpacing": 50, "rankSpacing": 80}}}%%');
    lines.push('');
    
    // Add graph declaration
    lines.push(`graph ${direction}`);
    lines.push('');
    
    // Get layer groups
    const layerGroups: Map<ArchitectureLayer, GraphNode[]> = this.isClassifiedGraph(graph)
      ? graph.layers
      : this.groupNodesByLayer(graph);
    
    // Aggregate nodes by layer and domain
    const aggregatedLayers = this.aggregateNodesByLayerAndDomain(layerGroups);
    
    // Define layer order
    const layerOrder: ArchitectureLayer[] = ['UI', 'API', 'Processing', 'Data', 'Storage'];
    
    // Collect external services
    const externalServiceNodes: GraphNode[] = [];
    for (const [, node] of graph.nodes) {
      if (node.type === 'external-service') {
        externalServiceNodes.push(node);
      }
    }
    
    // Add subgraph for each layer
    for (const layer of layerOrder) {
      const aggregatedNodes = aggregatedLayers.get(layer);
      if (!aggregatedNodes || aggregatedNodes.length === 0) continue;
      
      const layerIcon = this.getLayerIcon(layer);
      const layerName = layer === 'Processing' ? 'Services' : layer;
      lines.push(`    subgraph ${layer}["${layerIcon} ${layerName}"]`);
      
      // Add aggregated nodes
      for (const node of aggregatedNodes) {
        const mermaidId = this.sanitizeNodeId(node.id);
        const label = this.sanitizeLabelText(node.label || this.generateLabel(node.id));
        const shape = this.getNodeShape(node.type, node.id, label);
        lines.push(`        ${mermaidId}${shape[0]}${label}${shape[1]}`);
      }
      
      lines.push('    end');
      lines.push('');
    }
    
    // Add external services subgraph if any
    if (externalServiceNodes.length > 0) {
      lines.push('    subgraph ExternalServices["🌐 External Services"]');
      for (const node of externalServiceNodes) {
        const mermaidId = this.sanitizeNodeId(node.id);
        const label = this.sanitizeLabelText(node.label || this.generateLabel(node.id));
        const shape = this.getNodeShape(node.type, node.id, label);
        lines.push(`        ${mermaidId}${shape[0]}${label}${shape[1]}`);
      }
      lines.push('    end');
      lines.push('');
    }
    
    // Add layer-level connections (simplified edges)
    lines.push('    %% Layer Connections');
    const layerEdges = this.extractLayerLevelEdges(graph, layerGroups);
    for (const edge of layerEdges) {
      const fromId = this.sanitizeNodeId(edge.from);
      const toId = this.sanitizeNodeId(edge.to);
      lines.push(`    ${fromId} --> ${toId}`);
    }
    
    // Add classDef for external services
    if (externalServiceNodes.length > 0) {
      lines.push('');
      lines.push('    classDef externalService fill:#f0f4ff,stroke:#6b7280,stroke-width:2px,color:#1f2937');
      for (const node of externalServiceNodes) {
        const mermaidId = this.sanitizeNodeId(node.id);
        lines.push(`    class ${mermaidId} externalService`);
      }
    }
    
    const syntax = lines.join('\n');
    
    // Validate generated syntax
    this.validateMermaidSyntax(syntax);
    
    return {
      syntax,
      metadata: {
        nodeCount: aggregatedLayers.size,
        edgeCount: layerEdges.length,
        generatedAt: new Date(),
      },
    };
  }

  /**
   * Generates a detailed Mermaid diagram showing all individual modules and dependencies.
   * Uses subgraphs for organization by layer and domain.
   * @param graph - Dependency graph (or ClassifiedGraph) to visualize
   * @param options - Generation options
   * @returns MermaidDiagram - Generated detailed diagram with metadata
   */
  generateDetailed(graph: DependencyGraph | ClassifiedGraph, options: GenerationOptions = {}): MermaidDiagram {
    // Detailed generation is essentially the same as the regular generate() method
    // which already shows all modules and dependencies
    return this.generate(graph, options);
  }

  /**
   * Generates a Mermaid diagram from a dependency graph or classified graph.
   * When a ClassifiedGraph is provided, uses its pre-computed layers map for subgraph organization.
   * @param graph - Dependency graph (or ClassifiedGraph) to visualize
   * @param options - Generation options
   * @returns MermaidDiagram - Generated diagram with metadata
   */
  generate(graph: DependencyGraph | ClassifiedGraph, options: GenerationOptions = {}): MermaidDiagram {
    const direction = options.direction || 'LR'; // Force LR as default
    const showDependencies = options.showDependencies !== false;
    const groupByLayer = options.groupByLayer !== false;

    // Validate direction
    this.validateDirection(direction);

    // Validate node IDs
    this.validateNodeIds(graph);

    // Build Mermaid syntax
    const lines: string[] = [];
    
    // Add init block with nodeSpacing and rankSpacing for better layout
    lines.push('%%{init: {"flowchart": {"nodeSpacing": 50, "rankSpacing": 80}}}%%');
    lines.push('');
    
    // Add graph declaration with LR direction
    lines.push(`graph ${direction}`);
    lines.push('');
    
    // Group nodes by layer if enabled
    if (groupByLayer) {
      this.addLayeredNodes(lines, graph, showDependencies);
    } else {
      this.addSimpleNodes(lines, graph, showDependencies);
    }

    const syntax = lines.join('\n');

    // Validate generated syntax
    this.validateMermaidSyntax(syntax);

    return {
      syntax,
      metadata: {
        nodeCount: graph.nodes.size,
        edgeCount: graph.edges.length,
        generatedAt: new Date(),
      },
    };
  }

  /**
   * Aggregates nodes by layer and domain, creating representative nodes for each domain.
   * Limits to 20-30 high-level components.
   * @param layerGroups - Nodes grouped by layer
   * @returns Map<ArchitectureLayer, GraphNode[]> - Aggregated nodes per layer
   */
  private aggregateNodesByLayerAndDomain(layerGroups: Map<ArchitectureLayer, GraphNode[]>): Map<ArchitectureLayer, GraphNode[]> {
    const aggregated = new Map<ArchitectureLayer, GraphNode[]>();
    
    for (const [layer, nodes] of layerGroups) {
      if (nodes.length === 0) continue;
      
      // Group nodes by domain
      const domainGroups = this.groupNodesByDomain(nodes);
      const aggregatedNodes: GraphNode[] = [];
      
      // Create one representative node per domain
      for (const [domain, domainNodes] of domainGroups) {
        if (domainNodes.length === 0) continue;
        
        // Use the first node as representative, but update its label to indicate aggregation
        const representative: GraphNode = { ...domainNodes[0], externalCalls: domainNodes[0].externalCalls || [] };
        
        if (domain && domainNodes.length > 1) {
          // Multiple nodes in domain - create aggregated label
          representative.label = `${domain} (${domainNodes.length})`;
          representative.id = `${layer}_${domain}`;
        } else if (domainNodes.length === 1) {
          // Single node - keep as is
          representative.label = representative.label || this.generateLabel(representative.id);
        } else {
          // No domain - use generic label
          representative.label = `${layer} Component`;
          representative.id = `${layer}_component_${aggregatedNodes.length}`;
        }
        
        aggregatedNodes.push(representative);
      }
      
      aggregated.set(layer, aggregatedNodes);
    }
    
    return aggregated;
  }

  /**
   * Extracts layer-level edges from the graph.
   * Creates edges between layers based on dependencies between their nodes.
   * @param graph - Dependency graph
   * @param layerGroups - Nodes grouped by layer
   * @returns GraphEdge[] - Layer-level edges
   */
  private extractLayerLevelEdges(graph: DependencyGraph, layerGroups: Map<ArchitectureLayer, GraphNode[]>): GraphEdge[] {
    const layerEdges: GraphEdge[] = [];
    const seenEdges = new Set<string>();
    
    // Create a map of node ID to layer
    const nodeToLayer = new Map<string, ArchitectureLayer>();
    for (const [layer, nodes] of layerGroups) {
      for (const node of nodes) {
        nodeToLayer.set(node.id, layer);
      }
    }
    
    // Also add external services to the map
    for (const [, node] of graph.nodes) {
      if (node.type === 'external-service') {
        nodeToLayer.set(node.id, 'Storage'); // External services are treated as Storage layer
      }
    }
    
    // Extract layer-level edges
    for (const edge of graph.edges) {
      const fromLayer = nodeToLayer.get(edge.from);
      const toLayer = nodeToLayer.get(edge.to);
      
      // Only create edge if both nodes have layers and they're different
      if (fromLayer && toLayer && fromLayer !== toLayer) {
        const edgeKey = `${fromLayer}->${toLayer}`;
        
        // Avoid duplicate layer edges
        if (!seenEdges.has(edgeKey)) {
          seenEdges.add(edgeKey);
          
          // Create a representative edge from a node in fromLayer to a node in toLayer
          const fromNode = graph.nodes.get(edge.from);
          const toNode = graph.nodes.get(edge.to);
          
          if (fromNode && toNode) {
            layerEdges.push({
              from: fromNode.id,
              to: toNode.id,
              type: edge.type,
            });
          }
        }
      }
    }
    
    return layerEdges;
  }

  /**
   * Sanitizes a node ID to be valid for Mermaid
   * Ensures IDs are alphanumeric with underscores/dashes only
   * @param id - Original node ID
   * @returns string - Sanitized ID
   */
  private sanitizeNodeId(id: string): string {
    // Replace path separators and special characters with underscores
    let sanitized = id
      .replace(/[\/\\\.]/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '_')  // Replace all non-alphanumeric except underscore
      .replace(/_+/g, '_')  // Replace multiple underscores with single
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores

    // Ensure it starts with a letter
    if (!/^[a-zA-Z]/.test(sanitized)) {
      sanitized = 'node_' + sanitized;
    }

    return sanitized;
  }

  /**
   * Generates a human-readable label from a file path
   * Removes long paths and noise for cleaner display
   * @param filePath - File path
   * @returns string - Display label
   */
  private generateLabel(filePath: string): string {
    // Extract filename without extension and normalize path
    const normalizedPath = filePath.replace(/\\/g, '/');
    const parts = normalizedPath.split('/');
    const filename = parts[parts.length - 1];
    const nameWithoutExt = filename.replace(/\.(ts|tsx|js|jsx)$/, '');
    
    // Handle special Next.js files
    if (nameWithoutExt === 'page') {
      // Use parent directory name for page files
      const parentDir = parts[parts.length - 2];
      return parentDir ? this.formatName(this.sanitizeLabelText(parentDir)) : 'Page';
    }
    
    if (nameWithoutExt === 'layout') {
      const parentDir = parts[parts.length - 2];
      return parentDir ? `${this.formatName(this.sanitizeLabelText(parentDir))} Layout` : 'Layout';
    }
    
    if (nameWithoutExt === 'route') {
      const parentDir = parts[parts.length - 2];
      return parentDir ? `${this.formatName(this.sanitizeLabelText(parentDir))} API` : 'API';
    }
    
    // For other files, try to create a meaningful short name
    // Remove common prefixes and suffixes
    let cleanName = nameWithoutExt
      .replace(/^(use|get|post|put|delete|patch)/, '') // Remove HTTP method prefixes
      .replace(/(component|service|util|helper|handler)$/i, '') // Remove common suffixes
      .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
    
    // If name is too long, use parent directory context
    if (cleanName.length > 20) {
      const parentDir = parts[parts.length - 2];
      if (parentDir && parentDir !== 'components' && parentDir !== 'utils' && parentDir !== 'services') {
        cleanName = this.sanitizeLabelText(parentDir);
      } else {
        // Truncate long names
        cleanName = cleanName.substring(0, 15) + '...';
      }
    }
    
    // Convert to readable format
    return this.formatName(this.sanitizeLabelText(cleanName || nameWithoutExt));
  }

  /**
   * Sanitizes text for use in Mermaid labels by removing/replacing special characters
   * @param text - Text to sanitize
   * @returns string - Sanitized text safe for Mermaid labels
   */
  private sanitizeLabelText(text: string): string {
    return text
      // Remove dynamic route brackets like [slug] → slug
      .replace(/\[([^\]]*)\]/g, '$1')
      // Remove other characters that break Mermaid syntax
      .replace(/[{}<>"'()]/g, '')
      // Clean up any double spaces
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Formats a name to be more readable
   * @param name - Raw name
   * @returns string - Formatted name
   */
  private formatName(name: string): string {
    return name
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Adds nodes organized by layers with subgraphs.
   * When a ClassifiedGraph is provided, uses its pre-computed layers map.
   * Otherwise, infers layers from node metadata.
   * External-service nodes are grouped in a dedicated "External Services" subgraph.
   * Nodes are annotated with domain information and grouped by domain within layers.
   * @param lines - Output lines array
   * @param graph - Dependency graph (or ClassifiedGraph)
   * @param showDependencies - Whether to show dependency edges
   */
  private addLayeredNodes(lines: string[], graph: DependencyGraph | ClassifiedGraph, showDependencies: boolean): void {
    // Use pre-computed layers from ClassifiedGraph if available, otherwise infer them
    const layerGroups: Map<ArchitectureLayer, GraphNode[]> = this.isClassifiedGraph(graph)
      ? graph.layers
      : this.groupNodesByLayer(graph);
    
    // Define layer order for better visual organization
    const layerOrder: ArchitectureLayer[] = ['UI', 'API', 'Processing', 'Data', 'Storage'];
    
    // Collect external-service nodes separately
    const externalServiceNodes: GraphNode[] = [];
    
    // Add subgraph for each layer that has nodes (excluding external-service nodes)
    for (const layer of layerOrder) {
      const allNodes = layerGroups.get(layer) || [];
      // Filter out external-service nodes from regular layer subgraphs
      const nodes = allNodes.filter((n) => n.type !== 'external-service');
      if (nodes.length === 0) continue;
      
      const layerIcon = this.getLayerIcon(layer);
      const layerName = layer === 'Processing' ? 'Services' : layer; // Rename Processing to Services for clarity
      lines.push(`    subgraph ${layer}["${layerIcon} ${layerName}"]`);
      
      // Group nodes by domain within each layer if domains exist
      const domainGroups = this.groupNodesByDomain(nodes);
      
      // Check if we should create domain subgraphs:
      // - Multiple different domains exist, OR
      // - A single domain has multiple nodes
      const hasMultipleDomains = domainGroups.size > 1;
      const hasDomainWithMultipleNodes = Array.from(domainGroups.values()).some(
        domainNodes => domainNodes.length > 1 && domainNodes[0].domain !== undefined
      );
      const shouldCreateDomainSubgraphs = hasMultipleDomains || hasDomainWithMultipleNodes;
      
      if (shouldCreateDomainSubgraphs) {
        // Create sub-subgraphs for each domain that has multiple nodes or when multiple domains exist
        for (const [domain, domainNodes] of domainGroups) {
          if (domain && (domainNodes.length > 1 || hasMultipleDomains)) {
            // Create a domain subgraph
            const domainId = this.sanitizeNodeId(`${layer}_${domain}`);
            const domainLabel = this.sanitizeLabelText(domain);
            lines.push(`        subgraph ${domainId}["📦 ${domainLabel}"]`);
            for (const node of domainNodes) {
              const mermaidId = this.sanitizeNodeId(node.id);
              const label = this.sanitizeLabelText(node.label || this.generateLabel(node.id));
              const shape = this.getNodeShape(node.type, node.id, label);
              lines.push(`            ${mermaidId}${shape[0]}${label}${shape[1]}`);
            }
            lines.push('        end');
          } else {
            // Nodes without domain or single node without multiple domains - add directly
            for (const node of domainNodes) {
              const mermaidId = this.sanitizeNodeId(node.id);
              const label = this.sanitizeLabelText(node.label || this.generateLabel(node.id));
              const shape = this.getNodeShape(node.type, node.id, label);
              lines.push(`        ${mermaidId}${shape[0]}${label}${shape[1]}`);
            }
          }
        }
      } else {
        // Single domain or no domains - add nodes directly with domain annotation
        for (const node of nodes) {
          const mermaidId = this.sanitizeNodeId(node.id);
          const label = this.sanitizeLabelText(node.label || this.generateLabel(node.id));
          const shape = this.getNodeShape(node.type, node.id, label);
          // Add domain annotation to label if domain exists
          const annotatedLabel = node.domain ? `${label} (${node.domain})` : label;
          lines.push(`        ${mermaidId}${shape[0]}${annotatedLabel}${shape[1]}`);
        }
      }
      
      lines.push('    end');
      lines.push('');
    }

    // Collect all external-service nodes from the graph
    for (const [, node] of graph.nodes) {
      if (node.type === 'external-service') {
        externalServiceNodes.push(node);
      }
    }

    // Add dedicated "External Services" subgraph if there are any
    if (externalServiceNodes.length > 0) {
      lines.push('    subgraph ExternalServices["🌐 External Services"]');
      for (const node of externalServiceNodes) {
        const mermaidId = this.sanitizeNodeId(node.id);
        const label = this.sanitizeLabelText(node.label || this.generateLabel(node.id));
        const shape = this.getNodeShape(node.type, node.id, label);
        lines.push(`        ${mermaidId}${shape[0]}${label}${shape[1]}`);
      }
      lines.push('    end');
      lines.push('');
    }
    
    // Add edges if enabled
    if (showDependencies) {
      lines.push('    %% Dependencies');
      for (const edge of graph.edges) {
        const fromId = this.sanitizeNodeId(edge.from);
        const toId = this.sanitizeNodeId(edge.to);
        
        // Verify both nodes exist
        if (graph.nodes.has(edge.from) && graph.nodes.has(edge.to)) {
          const edgeLabel = this.getEdgeLabel(edge.type);
          if (edgeLabel) {
            lines.push(`    ${fromId} -- ${edgeLabel} --> ${toId}`);
          } else {
            lines.push(`    ${fromId} --> ${toId}`);
          }
        }
      }
    }

    // Add classDef and class assignments for external services
    if (externalServiceNodes.length > 0) {
      lines.push('');
      lines.push('    classDef externalService fill:#f0f4ff,stroke:#6b7280,stroke-width:2px,color:#1f2937');
      for (const node of externalServiceNodes) {
        const mermaidId = this.sanitizeNodeId(node.id);
        lines.push(`    class ${mermaidId} externalService`);
      }
    }
  }

  /**
   * Checks whether a graph is a ClassifiedGraph (has a layers property)
   * @param graph - Graph to check
   * @returns boolean - True if graph is a ClassifiedGraph
   */
  private isClassifiedGraph(graph: DependencyGraph | ClassifiedGraph): graph is ClassifiedGraph {
    return 'layers' in graph && graph.layers instanceof Map;
  }

  /**
   * Returns an optional edge label for a given edge type.
   * Returns undefined for 'import' edges (no label needed) and a label for 'external-call'.
   * @param type - Edge type
   * @returns string | undefined - Label text or undefined
   */
  private getEdgeLabel(type: EdgeType): string | undefined {
    if (type === 'external-call') {
      return 'calls';
    }
    // 'import' edges have no label for cleaner diagrams
    return undefined;
  }

  /**
   * Groups nodes by domain
   * @param nodes - Array of nodes to group
   * @returns Map<string | undefined, GraphNode[]> - Nodes grouped by domain
   */
  private groupNodesByDomain(nodes: GraphNode[]): Map<string | undefined, GraphNode[]> {
    const domainGroups = new Map<string | undefined, GraphNode[]>();
    
    for (const node of nodes) {
      const domain = node.domain;
      if (!domainGroups.has(domain)) {
        domainGroups.set(domain, []);
      }
      domainGroups.get(domain)!.push(node);
    }
    
    return domainGroups;
  }

  /**
   * Adds nodes without layer grouping
   * @param lines - Output lines array
   * @param graph - Dependency graph
   * @param showDependencies - Whether to show dependency edges
   */
  private addSimpleNodes(lines: string[], graph: DependencyGraph, showDependencies: boolean): void {
    // Add nodes
    for (const [id, node] of graph.nodes) {
      const mermaidId = this.sanitizeNodeId(id);
      const label = node.label || this.generateLabel(id);
      const shape = this.getNodeShape(node.type, node.id, label);
      
      lines.push(`    ${mermaidId}${shape[0]}${label}${shape[1]}`);
    }
    
    // Add edges if enabled
    if (showDependencies) {
      for (const edge of graph.edges) {
        const fromId = this.sanitizeNodeId(edge.from);
        const toId = this.sanitizeNodeId(edge.to);
        
        // Verify both nodes exist
        if (graph.nodes.has(edge.from) && graph.nodes.has(edge.to)) {
          const edgeLabel = this.getEdgeLabel(edge.type);
          if (edgeLabel) {
            lines.push(`    ${fromId} -- ${edgeLabel} --> ${toId}`);
          } else {
            lines.push(`    ${fromId} --> ${toId}`);
          }
        }
      }
    }
  }

  /**
   * Groups nodes by their architecture layer
   * @param graph - Dependency graph
   * @returns Map<ArchitectureLayer, GraphNode[]> - Nodes grouped by layer
   */
  private groupNodesByLayer(graph: DependencyGraph): Map<ArchitectureLayer, GraphNode[]> {
    const layerGroups = new Map<ArchitectureLayer, GraphNode[]>();
    
    // Initialize layer groups
    const layers: ArchitectureLayer[] = ['UI', 'API', 'Processing', 'Data', 'Storage'];
    for (const layer of layers) {
      layerGroups.set(layer, []);
    }
    
    // Group nodes by layer
    for (const [, node] of graph.nodes) {
      const layer = node.layer || this.inferLayer(node);
      const group = layerGroups.get(layer);
      if (group) {
        group.push(node);
      }
    }
    
    return layerGroups;
  }

  /**
   * Infers the architecture layer from a node
   * @param node - Graph node
   * @returns ArchitectureLayer - Inferred layer
   */
  private inferLayer(node: GraphNode): ArchitectureLayer {
    const path = node.id.toLowerCase();
    
    // API layer
    if (node.type === 'api' || path.includes('/api/')) {
      return 'API';
    }
    
    // UI layer
    if (node.type === 'route' || node.type === 'component') {
      return 'UI';
    }
    
    // Data layer
    if (path.includes('prisma') || path.includes('/db/') || path.includes('database')) {
      return 'Data';
    }
    
    // Processing layer (default for utilities)
    return 'Processing';
  }

  /**
   * Gets an icon for a layer
   * @param layer - Architecture layer
   * @returns string - Icon character
   */
  private getLayerIcon(layer: ArchitectureLayer): string {
    const icons = {
      'UI': '🎨',
      'API': '⚡',
      'Processing': '⚙️',
      'Data': '💾',
      'Storage': '🗄️'
    };
    return icons[layer] || '📦';
  }

  /**
   * Gets the Mermaid shape syntax for a node type
   * @param type - Node type
   * @param nodeId - Optional node ID for external-service sub-type detection
   * @param label - Optional label for context
   * @returns [string, string] - Opening and closing shape syntax
   */
  private getNodeShape(type: NodeType, nodeId?: string, label?: string): [string, string] {
    if (type === 'external-service') {
      // Determine sub-type from node ID or label
      const hint = ((nodeId || '') + ' ' + (label || '')).toLowerCase();
      if (
        hint.includes('db') ||
        hint.includes('database') ||
        hint.includes('prisma') ||
        hint.includes('mongoose') ||
        hint.includes('postgres') ||
        hint.includes('mysql') ||
        hint.includes('redis') ||
        hint.includes('mongo') ||
        hint.includes('sqlite') ||
        hint.includes('storage')
      ) {
        // Cylinder shape for databases
        return ['[(', ')]'];
      }
      if (
        hint.includes('api') ||
        hint.includes('http') ||
        hint.includes('fetch') ||
        hint.includes('axios') ||
        hint.includes('rest') ||
        hint.includes('graphql')
      ) {
        // Stadium shape for REST APIs / fetch URLs
        return ['([', '])'];
      }
      // Hexagon shape for unknown external services
      return ['{{', '}}'];
    }
    // Using simple rectangles for all other node types
    return ['[', ']'];
  }

  /**
   * Validates that the graph direction is valid
   * @param direction - Graph direction
   * @throws Error if direction is invalid
   */
  private validateDirection(direction: string): void {
    const validDirections = ['TB', 'LR', 'BT', 'RL'];
    if (!validDirections.includes(direction)) {
      throw new Error(
        `Invalid graph direction: ${direction}. Must be one of: ${validDirections.join(', ')}`
      );
    }
  }

  /**
   * Validates that all node IDs are unique and valid
   * @param graph - Dependency graph
   * @throws Error if validation fails
   */
  private validateNodeIds(graph: DependencyGraph): void {
    const ids = new Set<string>();
    
    for (const [id] of graph.nodes) {
      // Check for duplicates
      if (ids.has(id)) {
        throw new Error(`Duplicate node ID found: ${id}`);
      }
      ids.add(id);
      
      // Validate ID format (after sanitization, should be valid)
      const sanitized = this.sanitizeNodeId(id);
      if (!sanitized || sanitized.length === 0) {
        throw new Error(`Invalid node ID: ${id}`);
      }
    }
  }

  /**
   * Validates that the generated Mermaid syntax is well-formed
   * @param syntax - Generated Mermaid syntax
   * @throws Error if syntax is invalid
   */
  private validateMermaidSyntax(syntax: string): void {
    // Basic validation checks
    
    // Must contain graph declaration (allowing for init block)
    if (!syntax.match(/graph\s+(TB|LR|BT|RL)/)) {
      throw new Error('Mermaid syntax must contain graph declaration');
    }

    // Must have at least one node definition (bracket pair or special shape)
    const hasNode =
      /\[.*?\]/.test(syntax) ||
      /\(\[.*?\]\)/.test(syntax) ||
      /\[\(.*?\)\]/.test(syntax) ||
      /\{\{.*?\}\}/.test(syntax);
    if (!hasNode) {
      throw new Error('Mermaid diagram must contain at least one node');
    }
  }

  /**
   * Builds a simple dependency graph from parsed modules
   * This is a helper method for basic graph construction
   * @param modules - Array of parsed modules
   * @param options - Generation options for limiting nodes
   * @returns DependencyGraph - Constructed graph
   */
  buildGraph(modules: ParsedModule[], options: GenerationOptions = {}): DependencyGraph {
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    // Apply node limits if specified
    let limitedModules = modules;
    if (options.maxNodes && modules.length > options.maxNodes) {
      // Prioritize important files (routes, API endpoints, main components)
      const prioritized = this.prioritizeModules(modules);
      limitedModules = prioritized.slice(0, options.maxNodes);
    }

    // Create nodes for each module
    for (const module of limitedModules) {
      const nodeType = this.inferNodeType(module);
      const layer = this.inferLayerFromModule(module, nodeType);
      
      nodes.set(module.path, {
        id: module.path,
        type: nodeType,
        layer: layer,
        domain: this.inferDomain(module.path),
        externalCalls: [],
      });
    }

    // Create edges based on imports
    for (const module of limitedModules) {
      for (const importStmt of module.imports) {
        // Only create edges for internal dependencies that exist in our node set
        if (!importStmt.isExternal && nodes.has(importStmt.source)) {
          edges.push({
            from: module.path,
            to: importStmt.source,
            type: 'import',
          });
        }
      }
    }

    const graph = new DependencyGraph();
    graph.nodes = nodes;
    graph.edges = edges;
    return graph;
  }

  /**
   * Prioritizes modules for node limiting
   * @param modules - All parsed modules
   * @returns ParsedModule[] - Prioritized modules
   */
  private prioritizeModules(modules: ParsedModule[]): ParsedModule[] {
    return modules.sort((a, b) => {
      const scoreA = this.getModulePriority(a);
      const scoreB = this.getModulePriority(b);
      return scoreB - scoreA; // Higher score first
    });
  }

  /**
   * Gets priority score for a module
   * @param module - Parsed module
   * @returns number - Priority score (higher = more important)
   */
  private getModulePriority(module: ParsedModule): number {
    const path = module.path.toLowerCase();
    let score = 0;
    
    // API routes are high priority
    if (module.metadata.isApiRoute || path.includes('/api/')) {
      score += 100;
    }
    
    // Page routes are high priority
    if (path.includes('page.') || path.includes('/pages/')) {
      score += 90;
    }
    
    // Layout files are important
    if (path.includes('layout.')) {
      score += 80;
    }
    
    // Main components are important
    if (path.includes('/components/') && !path.includes('test')) {
      score += 70;
    }
    
    // Services and utilities are medium priority
    if (path.includes('/services/') || path.includes('/lib/') || path.includes('/utils/')) {
      score += 50;
    }
    
    // Config files are lower priority
    if (path.includes('config') || path.includes('constant')) {
      score += 30;
    }
    
    return score;
  }

  /**
   * Infers the architecture layer from a module and its type
   * Enhanced with better folder-based grouping
   * @param module - Parsed module
   * @param nodeType - Node type
   * @returns ArchitectureLayer - Inferred layer
   */
  private inferLayerFromModule(module: ParsedModule, nodeType: NodeType): ArchitectureLayer {
    const path = module.path.toLowerCase();
    
    // API layer - all API routes and handlers
    if (nodeType === 'api' || module.metadata.isApiRoute || path.includes('/api/')) {
      return 'API';
    }
    
    // UI layer - pages, layouts, and UI components
    if (nodeType === 'route' || module.metadata.isReactComponent) {
      return 'UI';
    }
    
    if (nodeType === 'component' || path.includes('/component') || path.includes('page.') || path.includes('layout.')) {
      return 'UI';
    }
    
    // Data layer - database, models, schemas
    if (path.includes('prisma') || path.includes('/db/') || path.includes('database') || 
        path.includes('model') || path.includes('schema') || path.includes('migration')) {
      return 'Data';
    }
    
    // Services layer - business logic, external integrations
    if (path.includes('/service') || path.includes('/integration') || path.includes('/client') ||
        path.includes('/provider') || path.includes('/adapter')) {
      return 'Processing';
    }
    
    // Utils layer - utilities, helpers, shared functions
    if (path.includes('/util') || path.includes('/helper') || path.includes('/lib/') ||
        path.includes('/shared') || path.includes('/common') || path.includes('/constant') ||
        path.includes('config') || nodeType === 'config') {
      return 'Processing';
    }
    
    // Default to Processing layer for utilities and unknown types
    return 'Processing';
  }

  /**
   * Infers domain from file path with improved folder-based grouping
   * @param filePath - File path
   * @returns string | undefined - Domain name
   */
  private inferDomain(filePath: string): string | undefined {
    const path = filePath.toLowerCase();
    const segments = path.split('/');
    
    // Look for domain indicators in path segments
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      // Skip common directory names
      if (['app', 'pages', 'api', 'src', 'components', 'lib', 'utils', 'services', 'types', 'hooks'].includes(segment)) {
        continue;
      }
      
      // Skip file names
      if (segment.includes('.')) {
        continue;
      }
      
      // Skip very short segments
      if (segment.length <= 2) {
        continue;
      }
      
      // Skip dynamic route segments like [slug], [id], [param]
      if (segment.startsWith('[') && segment.endsWith(']')) {
        continue;
      }
      
      // Look for meaningful domain names
      if (this.isDomainName(segment)) {
        return this.formatName(segment);
      }
    }
    
    // Try to extract domain from parent directories of specific patterns
    if (path.includes('/api/')) {
      const apiIndex = segments.indexOf('api');
      if (apiIndex >= 0 && apiIndex + 1 < segments.length) {
        const domainSegment = segments[apiIndex + 1];
        if (domainSegment && !domainSegment.includes('.') && domainSegment.length > 2) {
          return this.formatName(domainSegment);
        }
      }
    }
    
    return undefined;
  }

  /**
   * Checks if a segment represents a domain name
   * @param segment - Path segment
   * @returns boolean - True if it's likely a domain name
   */
  private isDomainName(segment: string): boolean {
    // Common domain patterns
    const domainPatterns = [
      'auth', 'user', 'admin', 'dashboard', 'profile', 'settings',
      'weather', 'risk', 'data', 'analytics', 'report', 'monitor',
      'payment', 'billing', 'order', 'product', 'inventory',
      'notification', 'message', 'chat', 'email', 'sms',
      'search', 'filter', 'export', 'import', 'sync',
      'backup', 'restore', 'migration', 'deployment'
    ];
    
    // Check if segment matches common domain patterns
    if (domainPatterns.some(pattern => segment.includes(pattern))) {
      return true;
    }
    
    // Check if segment is a meaningful business term (longer than 4 chars, not generic)
    if (segment.length > 4 && !['component', 'service', 'util', 'helper', 'handler', 'controller'].includes(segment)) {
      return true;
    }
    
    return false;
  }

  /**
   * Infers the node type from a parsed module
   * @param module - Parsed module
   * @returns NodeType - Inferred type
   */
  private inferNodeType(module: ParsedModule): NodeType {
    const path = module.path.toLowerCase();

    // API routes
    if (module.metadata.isApiRoute || path.includes('/api/')) {
      return 'api';
    }

    // Routes (pages)
    if (path.includes('/pages/') || path.includes('page.')) {
      return 'route';
    }

    // Components
    if (path.includes('/component') || module.metadata.isReactComponent) {
      return 'component';
    }

    // Config files
    if (path.includes('config') || path.includes('constant')) {
      return 'config';
    }

    // Default to utility
    return 'utility';
  }
}
