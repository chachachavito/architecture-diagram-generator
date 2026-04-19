import { describe, it, expect } from 'vitest';
import { DiagramGenerator } from '../DiagramGenerator';
import type { ClassifiedGraph, GraphNode, GraphEdge } from '../../core/DependencyGraph';

describe('DiagramGenerator - Detailed Generation (Task 26.2)', () => {
  // Helper functions for mock data
  const createNode = (id: string, type: GraphNode['type'] = 'component', label?: string): GraphNode => ({
    id,
    type,
    label,
    externalCalls: [],
  });

  const createEdge = (from: string, to: string, type: GraphEdge['type'] = 'import'): GraphEdge => ({
    from,
    to,
    type,
  });

  const createGraph = (nodes: GraphNode[], edges: GraphEdge[] = []): ClassifiedGraph => {
    // Put all nodes in a default layer so they are rendered
    const layers = new Map<string, GraphNode[]>([
      ['UI', nodes]
    ]);
    return {
      nodes: new Map(nodes.map(n => [n.id, n])),
      edges,
      layers,
      domains: new Map(),
    };
  };

  it('should include all nodes for complete module visibility', () => {
    const generator = new DiagramGenerator();
    const nodes = [
      createNode('moduleA', 'component'),
      createNode('moduleB', 'utility'),
      createNode('moduleC', 'api'),
    ];
    const graph = createGraph(nodes);

    const diagram = generator.generateDetailed(graph);

    expect(diagram.syntax).toContain('moduleA');
    expect(diagram.syntax).toContain('moduleB');
    expect(diagram.syntax).toContain('moduleC');
    expect(diagram.metadata.nodeCount).toBe(3);
  });

  it('should include all dependency edges correctly mapped', () => {
    const generator = new DiagramGenerator();
    const nodes = [
      createNode('moduleA', 'component'),
      createNode('moduleB', 'component'),
      createNode('moduleC', 'component'),
    ];
    const edges = [
      createEdge('moduleA', 'moduleB'),
      createEdge('moduleB', 'moduleC'),
      createEdge('moduleA', 'moduleC'),
    ];
    const graph = createGraph(nodes, edges);

    const diagram = generator.generateDetailed(graph);

    expect(diagram.metadata.edgeCount).toBe(3);

    const arrowMatches = diagram.syntax.match(/-->/g);
    expect(arrowMatches?.length).toBeGreaterThanOrEqual(3);
    
    expect(diagram.syntax).toMatch(/moduleA.*-->.*moduleB/);
    expect(diagram.syntax).toMatch(/moduleB.*-->.*moduleC/);
    expect(diagram.syntax).toMatch(/moduleA.*-->.*moduleC/);
  });
  
  it('should render detailed graph even when simplified flag might be considered in other contexts', () => {
    const generator = new DiagramGenerator();
    const nodes = [
      createNode('module1', 'component'),
      createNode('module2', 'component'),
    ];
    const edges = [createEdge('module1', 'module2')];
    const graph = createGraph(nodes, edges);

    const diagram = generator.generateDetailed(graph, { showDependencies: true });

    expect(diagram.metadata.nodeCount).toBe(2);
    expect(diagram.metadata.edgeCount).toBe(1);
    expect(diagram.syntax).toContain('module1');
    expect(diagram.syntax).toContain('module2');
  });
});
