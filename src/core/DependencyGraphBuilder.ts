import * as path from 'path';
import { ParsedModule } from '../parsers';
import { DependencyGraph, GraphNode, GraphEdge, NodeType, ArchitectureLayer } from './DependencyGraph';

/**
 * DependencyGraphBuilder constructs a DependencyGraph from an array of ParsedModules.
 *
 * Responsibilities:
 * - Create a GraphNode for each parsed module
 * - Resolve relative imports to absolute paths
 * - Create GraphEdge entries for internal imports
 * - Create virtual external-service nodes for external dependencies
 * - Mark edges as 'import' for internal or 'external-call' for external services
 */
export class DependencyGraphBuilder {
  private rootDir: string;

  /**
   * @param rootDir - Project root directory used for resolving absolute paths.
   *                  Defaults to the current working directory.
   */
  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
  }

  /**
   * Builds a DependencyGraph from an array of ParsedModules.
   *
   * @param modules - Array of parsed modules to build the graph from
   * @returns DependencyGraph - Fully constructed dependency graph
   */
  build(modules: ParsedModule[]): DependencyGraph {
    const graph = new DependencyGraph();

    // Pass 1: add a node for every module
    for (const module of modules) {
      this.addNode(graph, module);
    }

    // Pass 2: add edges based on import statements
    for (const module of modules) {
      const absoluteFrom = this.toAbsolute(module.path);

      for (const importStmt of module.imports) {
        if (importStmt.isExternal) {
          // Create a virtual external-service node (idempotent)
          const externalId = importStmt.source;
          if (!graph.hasNode(externalId)) {
            const externalNode: GraphNode = {
              id: externalId,
              type: 'external-service',
              externalCalls: [],
            };
            graph.addNode(externalNode);
          }

          // Edge: internal module → external service
          const edge: GraphEdge = {
            from: absoluteFrom,
            to: externalId,
            type: 'external-call',
          };
          graph.addEdge(edge);
        } else {
          // Resolve the import to an absolute path
          const absoluteTo = this.resolveImport(importStmt.source, module.path);

          // Only create an edge if the target node exists in the graph
          if (graph.hasNode(absoluteTo)) {
            const edge: GraphEdge = {
              from: absoluteFrom,
              to: absoluteTo,
              type: 'import',
            };
            graph.addEdge(edge);
          }
        }
      }

      // Also create external-call edges for detected external calls
      for (const extCall of module.externalCalls) {
        const serviceId = extCall.target || `external:${extCall.type}`;
        if (!graph.hasNode(serviceId)) {
          const serviceNode: GraphNode = {
            id: serviceId,
            type: 'external-service',
            layer: this.inferExternalServiceLayer(extCall.type),
            label: this.generateExternalServiceLabel(serviceId, extCall.type),
            externalCalls: [],
          };
          graph.addNode(serviceNode);
        }

        const edge: GraphEdge = {
          from: absoluteFrom,
          to: serviceId,
          type: 'external-call',
        };
        graph.addEdge(edge);
      }
    }

    return graph;
  }

  /**
   * Adds a GraphNode for the given ParsedModule to the graph.
   * The node ID is the absolute path of the module.
   *
   * @param graph - DependencyGraph to add the node to
   * @param module - ParsedModule to create a node for
   */
  addNode(graph: DependencyGraph, module: ParsedModule): void {
    const absolutePath = this.toAbsolute(module.path);
    const nodeType = this.inferNodeType(module);
    const layer = this.inferLayer(module, nodeType);
    const domain = this.inferDomain(module.path);

    const node: GraphNode = {
      id: absolutePath,
      type: nodeType,
      layer,
      domain,
      externalCalls: module.externalCalls,
    };

    graph.addNode(node);
  }

  /**
   * Adds a directed edge to the graph.
   *
   * @param graph - DependencyGraph to add the edge to
   * @param from - Source node ID
   * @param to - Target node ID
   * @param type - Edge type ('import' | 'external-call')
   */
  addEdge(
    graph: DependencyGraph,
    from: string,
    to: string,
    type: 'import' | 'external-call'
  ): void {
    graph.addEdge({ from, to, type });
  }

  /**
   * Resolves a relative import path to an absolute path.
   * If the import is already absolute, it is returned as-is.
   *
   * @param importSource - The import source string (may be relative or absolute)
   * @param fromFilePath - The file path that contains the import
   * @returns string - Resolved absolute path
   */
  private resolveImport(importSource: string, fromFilePath: string): string {
    // Handle TypeScript path alias '@/' → project root
    if (importSource.startsWith('@/')) {
      const relative = importSource.slice(2);
      return path.resolve(this.rootDir, relative);
    }

    if (path.isAbsolute(importSource)) {
      return importSource;
    }

    // If the source doesn't start with './' or '../', it was already resolved
    // by ASTParser relative to the project root (e.g., from '@/' alias resolution)
    if (!importSource.startsWith('./') && !importSource.startsWith('../')) {
      return path.resolve(this.rootDir, importSource);
    }

    // Resolve relative to the directory of the importing file
    const fromDir = path.dirname(this.toAbsolute(fromFilePath));
    return path.resolve(fromDir, importSource);
  }

  /**
   * Converts a file path to an absolute path relative to rootDir.
   *
   * @param filePath - Relative or absolute file path
   * @returns string - Absolute path
   */
  private toAbsolute(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.resolve(this.rootDir, filePath);
  }

  /**
   * Infers the NodeType from a ParsedModule.
   *
   * @param module - ParsedModule to classify
   * @returns NodeType
   */
  private inferNodeType(module: ParsedModule): NodeType {
    const normalizedPath = module.path.replace(/\\/g, '/').toLowerCase();

    if (module.metadata.isApiRoute || normalizedPath.includes('/api/')) {
      return 'api';
    }

    if (normalizedPath.includes('/pages/') || normalizedPath.includes('page.')) {
      return 'route';
    }

    if (normalizedPath.includes('/component') || module.metadata.isReactComponent) {
      return 'component';
    }

    if (normalizedPath.includes('config') || normalizedPath.includes('constant')) {
      return 'config';
    }

    return 'utility';
  }

  /**
   * Infers the ArchitectureLayer for a module.
   *
   * @param module - ParsedModule
   * @param nodeType - Already-inferred NodeType
   * @returns ArchitectureLayer
   */
  private inferLayer(module: ParsedModule, nodeType: NodeType): ArchitectureLayer {
    const normalizedPath = module.path.replace(/\\/g, '/').toLowerCase();

    if (nodeType === 'api' || module.metadata.isApiRoute) {
      return 'API';
    }

    if (
      nodeType === 'route' ||
      nodeType === 'component' ||
      module.metadata.isReactComponent
    ) {
      return 'UI';
    }

    if (
      normalizedPath.includes('prisma') ||
      normalizedPath.includes('/db/') ||
      normalizedPath.includes('database') ||
      normalizedPath.includes('model') ||
      normalizedPath.includes('schema')
    ) {
      return 'Data';
    }

    if (
      normalizedPath.includes('/service') ||
      normalizedPath.includes('/lib/') ||
      normalizedPath.includes('/util') ||
      normalizedPath.includes('/helper')
    ) {
      return 'Processing';
    }

    return 'Processing';
  }

  /**
   * Infers the ArchitectureLayer for an external service based on its call type.
   * Databases → 'Storage', APIs/fetch/axios → 'Processing'
   *
   * @param callType - ExternalCall type
   * @returns ArchitectureLayer
   */
  private inferExternalServiceLayer(callType: string): ArchitectureLayer {
    if (callType === 'database') {
      return 'Storage';
    }
    return 'Processing';
  }

  /**
   * Generates a clean, human-readable label for an external service node.
   *
   * Examples:
   *   'https://api.openweathermap.org/data/2.5/weather' → 'OpenWeathermap API'
   *   'prisma'  → 'Prisma DB'
   *   'mongoose' → 'Mongoose DB'
   *
   * @param serviceId - The service target (URL or package name)
   * @param callType  - ExternalCall type ('fetch' | 'axios' | 'database' | 'unknown')
   * @returns string - Human-readable label
   */
  generateExternalServiceLabel(serviceId: string, callType: string): string {
    // For database clients, append " DB"
    if (callType === 'database') {
      const name = serviceId.replace(/^@[^/]+\//, ''); // strip scoped package prefix
      return this.toTitleCase(name) + ' DB';
    }

    // For URLs, extract the hostname and make it readable
    if (serviceId.startsWith('http://') || serviceId.startsWith('https://')) {
      try {
        const url = new URL(serviceId);
        const hostname = url.hostname; // e.g. 'api.openweathermap.org'
        // Remove common prefixes like 'api.', 'www.'
        const cleaned = hostname.replace(/^(api\.|www\.)/, '');
        // Take the first segment of the domain (before the TLD)
        const parts = cleaned.split('.');
        const name = parts[0]; // e.g. 'openweathermap'
        return this.toTitleCase(name) + ' API';
      } catch {
        // Fallback for malformed URLs
        return serviceId;
      }
    }

    // For named services (e.g. package names), use title case
    return this.toTitleCase(serviceId) + ' API';
  }

  /**
   * Converts a string to Title Case, handling hyphens and underscores.
   *
   * @param str - Input string
   * @returns string - Title-cased string
   */
  private toTitleCase(str: string): string {
    return str
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  /**
   * Infers a domain name from a file path by examining path segments.
   *
   * @param filePath - File path to extract domain from
   * @returns string | undefined - Domain name or undefined
   */
  private inferDomain(filePath: string): string | undefined {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    const segments = normalized.split('/');

    const skipSegments = new Set([
      'app', 'pages', 'api', 'src', 'components', 'lib',
      'utils', 'services', 'types', 'hooks', 'public',
    ]);

    for (const segment of segments) {
      // Skip file names (contain dots)
      if (segment.includes('.')) continue;
      // Skip common directory names
      if (skipSegments.has(segment)) continue;
      // Skip very short or dynamic route segments
      if (segment.length <= 2) continue;
      if (segment.startsWith('[') && segment.endsWith(']')) continue;

      // Return the first meaningful segment as the domain
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    }

    return undefined;
  }
}
