import { 
  SourceGraph, 
  ClassifiedGraph, 
  AnalysisReport, 
  GraphSnapshot,
  NodeMetrics,
  ArchitectureRules
} from './GraphTypes';
import { Normalizer } from './Normalizer';
import { MetricsCalculator } from './MetricsCalculator';
import { ArchitectureClassifier } from './ArchitectureClassifier';
import { ArchitectureAnalyzer } from './ArchitectureAnalyzer';
import { ProjectConfig } from './ConfigValidator';
import { PluginManager } from './PluginManager';
import { AIDocumentationPlugin } from '../plugins/AIDocumentationPlugin';

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
 * ArchitecturePipeline orchestrates the 8-stage architectural analysis flow.
 */
export class ArchitecturePipeline {
  private normalizer = new Normalizer();
  private classifier = new ArchitectureClassifier();
  private metricsCalculator = new MetricsCalculator();
  private analyzer = new ArchitectureAnalyzer();
  public pluginManager = new PluginManager();

  constructor(private options: PipelineOptions) {
    // Register default plugins
    this.registerPlugins();
  }

  private registerPlugins(): void {
    // AI Documentation Plugin
    const aiConfig = (this.options.config as any).plugins?.find((p: any) => p.name === 'ai-documentation-enhancer');
    this.pluginManager.register(new AIDocumentationPlugin(aiConfig?.config || {}), {
      enabled: aiConfig?.enabled ?? true,
      log: (msg) => this.log(`[AIPlugin] ${msg}`)
    });
  }

  /**
   * Runs the full pipeline
   */
  async run(input: SourceGraph): Promise<{ 
    graph: ClassifiedGraph, 
    report: AnalysisReport, 
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
    await this.pluginManager.execute('afterClassification', classified);

    // 4. Enrich
    this.log('Stage: Enrich');
    // Manual overrides from config are handled inside classifier currently

    // 5. Compute Metrics
    this.log('Stage: Compute Metrics');
    const metrics = this.metricsCalculator.compute(classified);

    // 6. Sanitize
    this.log('Stage: Sanitize');
    const sanitized = this.sanitize(classified);

    // 7. Snapshot
    this.log('Stage: Snapshot');
    const snapshot = this.createSnapshot(sanitized);

    // 8. Analyze
    this.log('Stage: Analyze');
    const rules = this.getRules();
    const report = this.analyzer.analyze(snapshot, metrics, rules);

    this.log('Pipeline completed.');

    return {
      graph: snapshot,
      report,
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
        // Source node must exist
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

  private getRules(): ArchitectureRules[] {
    const defaultRules: ArchitectureRules[] = [
      { ruleId: 'cycles', ruleVersion: '1.0.0', enabled: true, severity: 'high' },
      { ruleId: 'god-object', ruleVersion: '1.0.0', enabled: true, severity: 'medium', thresholds: { maxConnections: 15 } },
      { ruleId: 'layer-violations', ruleVersion: '1.0.0', enabled: true, severity: 'critical' }
    ];

    if (!this.options.config.rules) return defaultRules;

    // Merge with config
    return defaultRules.map(def => {
      const configRule = this.options.config.rules?.find(r => r.ruleId === def.ruleId);
      if (configRule) {
        return { ...def, ...configRule };
      }
      return def;
    });
  }

  private log(message: string): void {
    if (this.options.debug) {
      console.error(`[DEBUG] [Pipeline] ${message}`);
    }
  }
}
