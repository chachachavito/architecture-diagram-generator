import { 
  SourceGraph, 
  ClassifiedGraph, 
  GraphSnapshot
} from './GraphTypes';
import { Normalizer } from './Normalizer';
import { ArchitectureClassifier } from './ArchitectureClassifier';
import { ProjectConfig } from './ConfigValidator';

export interface PipelineOptions {
  version: string;
  config: ProjectConfig;
  debug?: boolean;
  analysisScope?: string[];
  disabledRules?: string[];
  includeTimestamp?: boolean;
  rootDir: string;
}

/**
 * ArchitecturePipeline orchestrates the architectural parsing and graph generation flow.
 */
export class ArchitecturePipeline {
  private normalizer = new Normalizer();
  private classifier = new ArchitectureClassifier();
  constructor(private options: PipelineOptions) {}

  /**
   * Runs the pipeline to generate a classified graph.
   */
  async run(input: SourceGraph): Promise<{ 
    graph: ClassifiedGraph, 
    version: string 
  }> {
    this.log('Starting pipeline...');

    // 1. Validate
    this.validate(input);

    // 2. Normalize
    this.log('Stage: Normalize');
    const normalized = this.normalizer.normalize(input, this.options.rootDir);

    // 3. Classify
    this.log('Stage: Classify');
    this.classifier.classify(normalized.nodes, this.options.config);
    const classified: ClassifiedGraph = {
      ...normalized,
      version: this.options.version
    };

    // 4. Enrich
    this.log('Stage: Enrich');

    // 5. Sanitize
    this.log('Stage: Sanitize');
    const sanitized = this.sanitize(classified);

    // 6. Snapshot
    this.log('Stage: Snapshot');
    const snapshot = this.createSnapshot(sanitized);

    this.log('Pipeline completed.');

    return {
      graph: snapshot,
      version: this.options.version
    };
  }

  private validate(graph: SourceGraph): void {
    if (!graph.nodes || !graph.edges) {
      throw new Error('Invalid SourceGraph: missing nodes or edges');
    }
    
    const ids = new Set();
    for (const node of graph.nodes) {
      if (ids.has(node.id)) {
        throw new Error(`Duplicate NodeId detected: ${node.id}`);
      }
      ids.add(node.id);
    }

    for (const edge of graph.edges) {
      if (!ids.has(edge.from)) {
        throw new Error(`Invalid edge: source node ${edge.from} not found`);
      }
    }
  }

  private sanitize(graph: ClassifiedGraph): ClassifiedGraph {
    return JSON.parse(JSON.stringify(graph));
  }

  private createSnapshot(graph: ClassifiedGraph): GraphSnapshot {
    graph.nodes.sort((a, b) => a.id.localeCompare(b.id));
    graph.edges.sort((a, b) => {
      const fromCmp = a.from.localeCompare(b.from);
      if (fromCmp !== 0) return fromCmp;
      return a.to.localeCompare(b.to);
    });

    return this.deepFreeze(graph);
  }

  private deepFreeze<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    const propNames = Object.getOwnPropertyNames(obj);
    for (const name of propNames) {
      const value = (obj as any)[name];
      if (value && typeof value === 'object') {
        this.deepFreeze(value);
      }
    }
    return Object.freeze(obj);
  }

  private log(message: string): void {
    if (this.options.debug) {
      console.error(`[DEBUG] [Pipeline] ${message}`);
    }
  }
}
