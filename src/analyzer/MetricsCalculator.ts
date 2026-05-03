import { ClassifiedGraph } from '../core/GraphTypes';
import { ArchitectureMetrics } from './types';

/**
 * Computes structural metrics from the dependency graph.
 */
export class MetricsCalculator {
  compute(graph: ClassifiedGraph): ArchitectureMetrics {
    const internalNodes = graph.nodes.filter(n => n.metadata?.type !== 'external');
    const totalNodes = internalNodes.length;
    const totalEdges = graph.edges.length;

    // Fan-in / Fan-out
    const fanIn = new Map<string, number>();
    const fanOut = new Map<string, number>();

    for (const edge of graph.edges) {
      fanIn.set(edge.to, (fanIn.get(edge.to) || 0) + 1);
      fanOut.set(edge.from, (fanOut.get(edge.from) || 0) + 1);
    }

    let maxFanIn = { nodeId: '', value: 0 };
    let maxFanOut = { nodeId: '', value: 0 };

    for (const node of internalNodes) {
      const inVal = fanIn.get(node.id) || 0;
      const outVal = fanOut.get(node.id) || 0;
      if (inVal > maxFanIn.value) maxFanIn = { nodeId: node.id, value: inVal };
      if (outVal > maxFanOut.value) maxFanOut = { nodeId: node.id, value: outVal };
    }

    const avgFanIn = totalNodes > 0
      ? Math.round((Array.from(fanIn.values()).reduce((a, b) => a + b, 0) / totalNodes) * 100) / 100
      : 0;

    const avgFanOut = totalNodes > 0
      ? Math.round((Array.from(fanOut.values()).reduce((a, b) => a + b, 0) / totalNodes) * 100) / 100
      : 0;

    // Layer distribution
    const layerDistribution: Record<string, number> = {};
    for (const node of internalNodes) {
      const layer = node.metadata?.layer || 'Core';
      layerDistribution[layer] = (layerDistribution[layer] || 0) + 1;
    }

    return {
      totalNodes,
      totalEdges,
      avgFanIn,
      avgFanOut,
      maxFanIn,
      maxFanOut,
      circularDependencies: 0, // Filled by analyzer after rules run
      layerViolations: 0,      // Filled by analyzer after rules run
      layerDistribution,
    };
  }
}
