import { ClassifiedGraph, Issue, ArchitectureLayer } from '../../core/GraphTypes';
import { AnalysisRule, RuleConfig } from '../types';

const LAYER_ORDER: ArchitectureLayer[] = ['UI', 'API', 'Action', 'Service', 'Core', 'External'];

/**
 * Detects invalid dependencies between architectural layers.
 * A violation occurs when an inner layer depends on an outer layer
 * (e.g., Core → UI, Service → API).
 */
export class LayerViolationRule implements AnalysisRule {
  id = 'layer-violation';
  name = 'Layer Violation';
  category = 'layering' as const;
  defaultSeverity = 'high' as const;

  run(graph: ClassifiedGraph, config?: RuleConfig): Issue[] {
    const severity = config?.severity ?? this.defaultSeverity;
    const issues: Issue[] = [];
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

    for (const edge of graph.edges) {
      const source = nodeMap.get(edge.from);
      const target = nodeMap.get(edge.to);
      if (!source || !target) continue;

      const srcLayer = source.metadata?.layer || 'Core';
      const tgtLayer = target.metadata?.layer || 'Core';
      if (srcLayer === 'External' || tgtLayer === 'External') continue;

      const srcIdx = LAYER_ORDER.indexOf(srcLayer as ArchitectureLayer);
      const tgtIdx = LAYER_ORDER.indexOf(tgtLayer as ArchitectureLayer);
      if (srcIdx === -1 || tgtIdx === -1) continue;

      // Inner layers (higher index) should not depend on outer layers (lower index)
      if (srcIdx > tgtIdx) {
        issues.push({
          ruleId: this.id,
          type: 'layer-violation',
          category: 'layering',
          nodeId: edge.from,
          severity,
          message: `${srcLayer} layer depends on ${tgtLayer} layer (${source.metadata?.label || edge.from} → ${target.metadata?.label || edge.to})`,
          confidence: 0.9,
          suggestion: `Move logic from ${srcLayer} to a lower or shared layer, or decouple via an interface/injection.`,
          why: 'Breaks separation of concerns. Layers should only depend on layers below them in the stack.',
          metadata: { sourceLayer: srcLayer, targetLayer: tgtLayer }
        });
      }
    }

    return issues;
  }
}
