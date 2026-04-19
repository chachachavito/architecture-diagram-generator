import { GraphSnapshot, NodeMetrics, Issue, ArchitectureRules } from '../GraphTypes';

/**
 * Rule: Detect "God Objects" - modules with excessive dependencies or dependants.
 */
export function detectGodObject(
  snapshot: GraphSnapshot, 
  metrics: Map<string, NodeMetrics>, 
  rule: ArchitectureRules
): Issue[] {
  const issues: Issue[] = [];
  const threshold = rule.thresholds?.maxConnections || 15;

  for (const [nodeId, nodeMetrics] of metrics.entries()) {
    const totalConnections = nodeMetrics.inDegree + nodeMetrics.outDegree;
    
    if (totalConnections > threshold) {
      issues.push({
        ruleId: rule.ruleId,
        type: 'god-object',
        category: 'coupling',
        nodeId: nodeId,
        severity: rule.severity,
        message: `Module has excessive connections (${totalConnections}). Consider splitting it.`,
        confidence: Math.min(1.0, totalConnections / (threshold * 2))
      });
    }
  }

  return issues;
}
