import { GraphSnapshot, NodeMetrics, Issue, ArchitectureRules, ArchitectureLayer, IssueSeverity } from '../GraphTypes';

/**
 * Rule: Detect violations of architectural layer boundaries.
 */
export function detectLayerViolation(
  snapshot: GraphSnapshot, 
  metrics: Map<string, NodeMetrics>, 
  rule: ArchitectureRules): Issue[] {
  const issues: Issue[] = [];

  const rulesMap: Partial<Record<ArchitectureLayer, Partial<Record<ArchitectureLayer, IssueSeverity>>>> = {
    'UI': {
      'Action': 'medium',
      'Core': 'high',
      'External': 'high'
    },
    'API': {
      'UI': 'high'
    },
    'Service': {
      'UI': 'high'
    }
  };

  for (const edge of snapshot.edges) {
    const fromNode = snapshot.nodes.find(n => n.id === edge.from);
    const toNode = snapshot.nodes.find(n => n.id === edge.to);

    if (fromNode?.metadata.layer && toNode?.metadata.layer) {
      const sourceRules = rulesMap[fromNode.metadata.layer];
      if (sourceRules && sourceRules[toNode.metadata.layer]) {
        const severity = sourceRules[toNode.metadata.layer]!;
        issues.push({
          ruleId: rule.ruleId,
          type: 'layer-violation',
          category: 'layering',
          nodeId: fromNode.id,
          severity: severity,
          message: `Layer violation: ${fromNode.metadata.layer} module cannot import from ${toNode.metadata.layer} module.`,
          confidence: 1.0
        });
      }
    }
  }

  return issues;
}
