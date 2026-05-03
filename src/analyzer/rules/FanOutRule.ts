import { ClassifiedGraph, Issue } from '../../core/GraphTypes';
import { AnalysisRule, RuleConfig } from '../types';

/**
 * Detects modules with too many outgoing dependencies (fan-out).
 */
export class FanOutRule implements AnalysisRule {
  id = 'high-fan-out';
  name = 'High Fan-Out';
  category = 'coupling' as const;
  defaultSeverity = 'medium' as const;

  private readonly defaultThreshold = 8;

  run(graph: ClassifiedGraph, config?: RuleConfig): Issue[] {
    const severity = config?.severity ?? this.defaultSeverity;
    const threshold = config?.thresholds?.['maxFanOut'] ?? this.defaultThreshold;
    const issues: Issue[] = [];
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

    const fanOut = new Map<string, number>();
    for (const edge of graph.edges) {
      fanOut.set(edge.from, (fanOut.get(edge.from) || 0) + 1);
    }

    for (const [nodeId, count] of fanOut) {
      if (count > threshold) {
        const node = nodeMap.get(nodeId);
        if (node?.metadata?.type === 'external') continue;

        issues.push({
          ruleId: this.id,
          type: 'high-fan-out',
          category: 'coupling',
          nodeId,
          severity,
          message: `${node?.metadata?.label || nodeId} has ${count} outgoing dependencies (threshold: ${threshold})`,
          confidence: 0.85,
          suggestion: 'Split module responsibilities or extract smaller services to reduce complexity.',
          why: 'High fan-out indicates high coupling, making the module harder to test and maintain.',
          metadata: { value: count, threshold }
        });
      }
    }

    return issues;
  }
}
