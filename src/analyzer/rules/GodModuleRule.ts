import { ClassifiedGraph, Issue } from '../../core/GraphTypes';
import { AnalysisRule, RuleConfig } from '../types';

/**
 * Detects god modules — modules that have both high fan-in AND high fan-out,
 * acting as a central hub that couples many parts of the system.
 */
export class GodModuleRule implements AnalysisRule {
  id = 'god-module';
  name = 'God Module';
  category = 'structure' as const;
  defaultSeverity = 'high' as const;

  private readonly defaultFanInThreshold = 6;
  private readonly defaultFanOutThreshold = 6;

  run(graph: ClassifiedGraph, config?: RuleConfig): Issue[] {
    const severity = config?.severity ?? this.defaultSeverity;
    const maxFanIn = config?.thresholds?.['maxFanIn'] ?? this.defaultFanInThreshold;
    const maxFanOut = config?.thresholds?.['maxFanOut'] ?? this.defaultFanOutThreshold;
    const issues: Issue[] = [];

    const fanIn = new Map<string, number>();
    const fanOut = new Map<string, number>();

    for (const edge of graph.edges) {
      fanIn.set(edge.to, (fanIn.get(edge.to) || 0) + 1);
      fanOut.set(edge.from, (fanOut.get(edge.from) || 0) + 1);
    }

    for (const node of graph.nodes) {
      if (node.metadata?.type === 'external') continue;

      const inCount = fanIn.get(node.id) || 0;
      const outCount = fanOut.get(node.id) || 0;

      if (inCount >= maxFanIn && outCount >= maxFanOut) {
        issues.push({
          ruleId: this.id,
          type: 'god-module',
          category: 'structure',
          nodeId: node.id,
          severity,
          message: `${node.metadata?.label || node.id} is a god module (fan-in: ${inCount}, fan-out: ${outCount})`,
          confidence: 0.8,
          suggestion: 'Refactor this module by splitting its responsibilities into smaller, more focused modules.',
          why: 'God modules violate the Single Responsibility Principle and become difficult to maintain and test.',
          metadata: { fanIn: inCount, fanOut: outCount }
        });
      }
    }

    return issues;
  }
}
