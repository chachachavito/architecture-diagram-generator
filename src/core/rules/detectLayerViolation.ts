import { GraphSnapshot, NodeMetrics, Issue, ArchitectureRules, ArchitectureLayer } from '../GraphTypes';

/**
 * Rule: Detect violations of architectural layer boundaries.
 */
export function detectLayerViolation(
  snapshot: GraphSnapshot, 
  metrics: Map<string, NodeMetrics>, 
  rule: ArchitectureRules
): Issue[] {
  const issues: Issue[] = [];
  
  // Define illegal imports (layer -> forbidden layers)
  const forbiddenImports: Partial<Record<ArchitectureLayer, ArchitectureLayer[]>> = {
    'Data': ['API', 'UI', 'Core'],
    'Core': ['API', 'UI'],
    'Lib': ['API', 'UI', 'Core', 'Data'],
    'External': ['API', 'UI', 'Core', 'Data', 'Lib']
  };

  for (const edge of snapshot.edges) {
    const fromNode = snapshot.nodes.find(n => n.id === edge.from);
    const toNode = snapshot.nodes.find(n => n.id === edge.to);

    if (fromNode?.metadata.layer && toNode?.metadata.layer) {
      const forbidden = forbiddenImports[fromNode.metadata.layer];
      if (forbidden && forbidden.includes(toNode.metadata.layer)) {
        issues.push({
          ruleId: rule.ruleId,
          type: 'layer-violation',
          category: 'layering',
          nodeId: fromNode.id,
          severity: rule.severity,
          message: `Layer violation: ${fromNode.metadata.layer} module cannot import from ${toNode.metadata.layer} module.`,
          confidence: 1.0
        });
      }
    }
  }

  return issues;
}
