import { ClassifiedGraph, Issue } from '../../core/GraphTypes';
import { AnalysisRule, RuleConfig } from '../types';

/**
 * Detects circular dependencies using iterative DFS.
 * Reports each unique cycle found in the dependency graph.
 */
export class CircularDependencyRule implements AnalysisRule {
  id = 'circular-dependency';
  name = 'Circular Dependency';
  category = 'structure' as const;
  defaultSeverity = 'critical' as const;

  run(graph: ClassifiedGraph, config?: RuleConfig): Issue[] {
    const severity = config?.severity ?? this.defaultSeverity;
    const issues: Issue[] = [];

    // Build adjacency list
    const adj = new Map<string, string[]>();
    for (const node of graph.nodes) adj.set(node.id, []);
    for (const edge of graph.edges) {
      const targets = adj.get(edge.from);
      if (targets) targets.push(edge.to);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();
    const reportedCycles = new Set<string>();

    const dfs = (nodeId: string, path: string[]): void => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);

      for (const neighbor of adj.get(nodeId) || []) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, path);
        } else if (recStack.has(neighbor)) {
          // Cycle detected — extract cycle path
          const cycleStart = path.indexOf(neighbor);
          const cyclePath = path.slice(cycleStart);
          const cycleKey = [...cyclePath].sort().join('→');

          if (!reportedCycles.has(cycleKey)) {
            reportedCycles.add(cycleKey);
            const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
            const labels = cyclePath.map(id => nodeMap.get(id)?.metadata?.label || id.split('/').pop() || id);

            issues.push({
              ruleId: this.id,
              type: 'circular-dependency',
              category: 'structure',
              nodeId: neighbor,
              severity,
              message: `Circular dependency: ${labels.join(' → ')} → ${labels[0]}`,
              confidence: 1.0,
              suggestion: 'Break the cycle by extracting shared logic to a common dependency or using an event-driven approach.',
              why: 'Circular dependencies lead to tightly coupled code, making it difficult to test and prone to memory leaks.',
              metadata: { path: cyclePath }
            });
          }
        }
      }

      path.pop();
      recStack.delete(nodeId);
    };

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return issues;
  }
}
