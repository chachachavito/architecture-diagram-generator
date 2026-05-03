import { ClassifiedGraph } from '../core/GraphTypes';
import { AnalysisResult, RuleConfig, ANALYSIS_SCHEMA_VERSION } from './types';
import { RuleEngine } from './RuleEngine';
import { MetricsCalculator } from './MetricsCalculator';
import { AnalyzerConfig, DEFAULT_ANALYZER_CONFIG, toRuleOverrides } from './AnalyzerConfig';

// Built-in rules
import { LayerViolationRule } from './rules/LayerViolationRule';
import { CircularDependencyRule } from './rules/CircularDependencyRule';
import { FanOutRule } from './rules/FanOutRule';
import { FanInRule } from './rules/FanInRule';
import { GodModuleRule } from './rules/GodModuleRule';

// ── Default Scoring Weights ──────────────────────────────────────────────────
const DEFAULT_WEIGHTS: Record<string, number> = {
  critical: 15,
  high: 8,
  medium: 3,
  low: 1,
};

/**
 * ArchitectureAnalyzer orchestrates rule execution, metrics computation,
 * and score calculation against a classified dependency graph.
 */
export class ArchitectureAnalyzer {
  private engine = new RuleEngine();
  private metricsCalc = new MetricsCalculator();
  private overrides: Record<string, RuleConfig>;
  private scoringWeights: Record<string, number>;

  constructor(config?: AnalyzerConfig) {
    const cfg = config ?? DEFAULT_ANALYZER_CONFIG;

    // Register all built-in rules
    this.engine.registerAll([
      new LayerViolationRule(),
      new CircularDependencyRule(),
      new FanOutRule(),
      new FanInRule(),
      new GodModuleRule(),
    ]);

    this.overrides = toRuleOverrides(cfg);
    this.scoringWeights = cfg.scoring?.weights ?? DEFAULT_WEIGHTS;
  }

  /**
   * Run full analysis against the graph.
   */
  run(graph: ClassifiedGraph): AnalysisResult {
    // 1. Execute rules
    const issues = this.engine.execute(graph, this.overrides);

    // 2. Compute metrics
    const metrics = this.metricsCalc.compute(graph);

    // Enrich metrics with rule results
    metrics.circularDependencies = issues.filter(i => i.ruleId === 'circular-dependency').length;
    metrics.layerViolations = issues.filter(i => i.ruleId === 'layer-violation').length;

    // 3. Compute score
    const score = this.computeScore(issues);

    // 4. Build summary
    const summary = {
      totalIssues: issues.length,
      criticalIssues: issues.filter(i => i.severity === 'critical').length,
      highIssues: issues.filter(i => i.severity === 'high').length,
      layerViolations: metrics.layerViolations,
      cycles: metrics.circularDependencies,
    };

    return { schemaVersion: ANALYSIS_SCHEMA_VERSION, score, issues, suggestions: [], metrics, summary };
  }

  private computeScore(issues: { severity: string }[]): number {
    let score = 100;
    for (const issue of issues) {
      score -= this.scoringWeights[issue.severity] || 1;
    }
    return Math.max(0, Math.min(100, score));
  }
}
