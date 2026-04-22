import * as path from 'path';
import { ParsedModule } from '../parsers';
import { 
  GraphNode, 
  SourceGraph, 
} from './GraphTypes';
import { DependencyGraph } from './DependencyGraph';

/**
 * DependencyGraphBuilder constructs a DependencyGraph from an array of ParsedModules.
 */
export class DependencyGraphBuilder {
  private rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
  }

  /**
   * Builds a SourceGraph from an array of ParsedModules.
   */
  build(modules: ParsedModule[]): SourceGraph {
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
          const externalId = importStmt.source;
          if (!graph.hasNode(externalId)) {
            const externalNode: GraphNode = {
              id: externalId,
              metadata: {
                type: 'external',
                source: 'inferred',
                label: externalId
              },
              type: 'external', // Legacy
              label: externalId, // Legacy
              externalCalls: [],
            };
            graph.addNode(externalNode);
          }

          graph.addEdge({
            id: `${absoluteFrom}->${externalId}:import`,
            from: absoluteFrom,
            to: externalId,
            type: 'import',
          });
        } else {
          const absoluteTo = this.resolveImport(importStmt.source, module.path);

          if (graph.hasNode(absoluteTo)) {
            graph.addEdge({
              id: `${absoluteFrom}->${absoluteTo}:import`,
              from: absoluteFrom,
              to: absoluteTo,
              type: 'import',
              isTypeOnly: importStmt.isTypeOnly,
            });
          }
        }
      }

      // Filter out empty external calls
      const validExternalCalls = module.externalCalls.filter(call => call && (call.target || call.type));
      for (const extCall of validExternalCalls) {
        const serviceId = extCall.target || `external:${extCall.type}`;
        if (!graph.hasNode(serviceId)) {
          const serviceNode: GraphNode = {
            id: serviceId,
            metadata: {
              type: 'external',
              source: 'inferred',
              label: serviceId
            },
            type: 'external', // Legacy
            label: serviceId, // Legacy
            externalCalls: [],
          };
          graph.addNode(serviceNode);
        }

        graph.addEdge({
          id: `${absoluteFrom}->${serviceId}:external-call`,
          from: absoluteFrom,
          to: serviceId,
          type: 'external-call',
        });
      }
    }

    return {
      nodes: Array.from(graph.nodes.values()),
      edges: graph.edges
    };
  }

  private addNode(graph: DependencyGraph, module: ParsedModule): void {
    const absolutePath = this.toAbsolute(module.path);
    
    const node: GraphNode = {
      id: absolutePath,
      metadata: {
        type: 'module',
        source: 'inferred',
        inheritance: module.metadata.inheritance,
        decorators: module.metadata.decorators,
        metrics: module.metadata.metrics,
      },
      type: 'module', // Legacy
      externalCalls: module.externalCalls,
    };

    graph.addNode(node);
  }

  private resolveImport(importSource: string, fromFilePath: string): string {
    if (importSource.startsWith('@/')) {
      const relative = importSource.slice(2);
      return path.resolve(this.rootDir, relative);
    }

    if (path.isAbsolute(importSource)) {
      return importSource;
    }

    if (!importSource.startsWith('./') && !importSource.startsWith('../')) {
      return path.resolve(this.rootDir, importSource);
    }

    const fromDir = path.dirname(this.toAbsolute(fromFilePath));
    return path.resolve(fromDir, importSource);
  }

  private toAbsolute(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.resolve(this.rootDir, filePath);
  }
}
