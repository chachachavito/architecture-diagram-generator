import { SourceGraph, NodeMetrics } from './GraphTypes';

/**
 * MetricsCalculator computes graph metrics such as degrees and centrality.
 * Pure function: does not access external state.
 */
export class MetricsCalculator {
  /**
   * Computes metrics for all nodes in the graph
   */
  compute(graph: SourceGraph): Map<string, NodeMetrics> {
    const metricsMap = new Map<string, NodeMetrics>();

    // Initialize metrics for all nodes
    for (const node of graph.nodes) {
      metricsMap.set(node.id, {
        inDegree: 0,
        outDegree: 0,
        centrality: 0,
        dependencies: [],
        dependents: []
      });
    }

    // Compute degrees and connections
    for (const edge of graph.edges) {
      const fromMetrics = metricsMap.get(edge.from);
      const toMetrics = metricsMap.get(edge.to);

      if (fromMetrics) {
        fromMetrics.outDegree++;
        if (!fromMetrics.dependencies.includes(edge.to)) {
          fromMetrics.dependencies.push(edge.to);
        }
      }

      if (toMetrics) {
        toMetrics.inDegree++;
        if (!toMetrics.dependents.includes(edge.from)) {
          toMetrics.dependents.push(edge.from);
        }
      }
    }

    // Compute simple centrality (normalized degree centrality)
    const nodeCount = graph.nodes.length;
    if (nodeCount > 1) {
      for (const metrics of metricsMap.values()) {
        metrics.centrality = (metrics.inDegree + metrics.outDegree) / (nodeCount - 1);
      }
    }

    return metricsMap;
  }
}
