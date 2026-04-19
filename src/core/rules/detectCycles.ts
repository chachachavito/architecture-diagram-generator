import { GraphSnapshot, NodeMetrics, Issue, ArchitectureRules } from '../GraphTypes';

/**
 * Rule: Detect circular dependencies in the graph.
 */
export function detectCycles(
  snapshot: GraphSnapshot, 
  metrics: Map<string, NodeMetrics>, 
  rule: ArchitectureRules
): Issue[] {
  const issues: Issue[] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();

  function findCycles(nodeId: string, path: string[]) {
    visited.add(nodeId);
    stack.add(nodeId);

    const nodeMetrics = metrics.get(nodeId);
    if (nodeMetrics) {
      for (const depId of nodeMetrics.dependencies) {
        if (!visited.has(depId)) {
          findCycles(depId, [...path, nodeId]);
        } else if (stack.has(depId)) {
          // Cycle detected
          const cyclePath = [...path, nodeId, depId];
          issues.push({
            ruleId: rule.ruleId,
            type: 'circular-dependency',
            category: 'structure',
            nodeId: depId,
            severity: rule.severity,
            message: `Circular dependency detected: ${cyclePath.join(' -> ')}`,
            confidence: 1.0
          });
        }
      }
    }

    stack.delete(nodeId);
  }

  for (const node of snapshot.nodes) {
    if (!visited.has(node.id)) {
      findCycles(node.id, []);
    }
  }

  return issues;
}
