import { ClassifiedGraph, Issue } from '../../core/GraphTypes';
import { AnalysisRule, RuleConfig } from '../types';

/**
 * Detects modules with too many incoming dependencies (fan-in).
 * High fan-in indicates a module that many others depend on — potential bottleneck.
 */
export class FanInRule implements AnalysisRule {
  id = 'high-fan-in';
  name = 'High Fan-In';
  category = 'coupling' as const;
  defaultSeverity = 'medium' as const;

  private readonly defaultThreshold = 10;

  run(graph: ClassifiedGraph, config?: RuleConfig): Issue[] {
    const severity = config?.severity ?? this.defaultSeverity;
    const threshold = config?.thresholds?.['maxFanIn'] ?? this.defaultThreshold;
    const issues: Issue[] = [];
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

    const fanIn = new Map<string, number>();
    for (const edge of graph.edges) {
      fanIn.set(edge.to, (fanIn.get(edge.to) || 0) + 1);
    }

    for (const [nodeId, count] of fanIn) {
      if (count > threshold) {
        const node = nodeMap.get(nodeId);
        if (node?.metadata?.type === 'external') continue;

        issues.push({
          ruleId: this.id,
          type: 'high-fan-in',
          category: 'coupling',
          nodeId,
          severity,
          message: `${node?.metadata?.label || nodeId} has ${count} incoming dependencies (threshold: ${threshold})`,
          confidence: 0.85,
          suggestion: 'Check if this module is becoming too central. Consider decoupling or introducing an abstraction layer.',
          why: 'High fan-in makes this module a bottleneck. Changes here will have a high impact across the system.',
          metadata: { value: count, threshold }
        });
      }
    }

    return issues;
  }
}
