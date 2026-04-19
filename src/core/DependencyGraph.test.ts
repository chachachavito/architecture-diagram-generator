import { DependencyGraph, GraphNode, GraphEdge } from './DependencyGraph';

describe('DependencyGraph', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  describe('constructor', () => {
    it('initializes with empty nodes and edges', () => {
      expect(graph.nodes.size).toBe(0);
      expect(graph.edges).toHaveLength(0);
    });
  });

  describe('addNode()', () => {
    it('adds a node to the graph', () => {
      const node: GraphNode = {
        id: 'app/page.tsx',
        type: 'route',
        externalCalls: [],
      };
      graph.addNode(node);
      expect(graph.nodes.size).toBe(1);
      expect(graph.nodes.get('app/page.tsx')).toEqual(node);
    });

    it('overwrites an existing node with the same ID', () => {
      const node1: GraphNode = { id: 'app/page.tsx', type: 'route', externalCalls: [] };
      const node2: GraphNode = { id: 'app/page.tsx', type: 'component', externalCalls: [] };
      graph.addNode(node1);
      graph.addNode(node2);
      expect(graph.nodes.size).toBe(1);
      expect(graph.nodes.get('app/page.tsx')!.type).toBe('component');
    });

    it('stores layer and domain when provided', () => {
      const node: GraphNode = {
        id: 'app/api/risk/route.ts',
        type: 'api',
        layer: 'API',
        domain: 'Risk',
        externalCalls: [],
      };
      graph.addNode(node);
      const stored = graph.nodes.get('app/api/risk/route.ts')!;
      expect(stored.layer).toBe('API');
      expect(stored.domain).toBe('Risk');
    });

    it('stores externalCalls on the node', () => {
      const node: GraphNode = {
        id: 'lib/weather.ts',
        type: 'utility',
        externalCalls: [
          { type: 'fetch', target: 'https://api.openweathermap.org', location: { line: 10 } },
        ],
      };
      graph.addNode(node);
      const stored = graph.nodes.get('lib/weather.ts')!;
      expect(stored.externalCalls).toHaveLength(1);
      expect(stored.externalCalls[0].target).toBe('https://api.openweathermap.org');
    });
  });

  describe('addEdge()', () => {
    it('adds an edge to the graph', () => {
      const edge: GraphEdge = { from: 'app/page.tsx', to: 'lib/utils.ts', type: 'import' };
      graph.addEdge(edge);
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0]).toEqual(edge);
    });

    it('does not add duplicate edges', () => {
      const edge: GraphEdge = { from: 'app/page.tsx', to: 'lib/utils.ts', type: 'import' };
      graph.addEdge(edge);
      graph.addEdge(edge);
      expect(graph.edges).toHaveLength(1);
    });

    it('allows edges with different types between the same nodes', () => {
      graph.addEdge({ from: 'a', to: 'b', type: 'import' });
      graph.addEdge({ from: 'a', to: 'b', type: 'external-call' });
      expect(graph.edges).toHaveLength(2);
    });

    it('allows multiple edges from different sources to the same target', () => {
      graph.addEdge({ from: 'a', to: 'c', type: 'import' });
      graph.addEdge({ from: 'b', to: 'c', type: 'import' });
      expect(graph.edges).toHaveLength(2);
    });
  });

  describe('hasNode()', () => {
    it('returns true for an existing node', () => {
      graph.addNode({ id: 'app/page.tsx', type: 'route', externalCalls: [] });
      expect(graph.hasNode('app/page.tsx')).toBe(true);
    });

    it('returns false for a non-existing node', () => {
      expect(graph.hasNode('nonexistent.ts')).toBe(false);
    });
  });

  describe('getNode()', () => {
    it('returns the node for an existing ID', () => {
      const node: GraphNode = { id: 'lib/utils.ts', type: 'utility', externalCalls: [] };
      graph.addNode(node);
      expect(graph.getNode('lib/utils.ts')).toEqual(node);
    });

    it('returns undefined for a non-existing ID', () => {
      expect(graph.getNode('missing.ts')).toBeUndefined();
    });
  });

  describe('getEdgesFrom()', () => {
    it('returns edges originating from the given node', () => {
      graph.addEdge({ from: 'a', to: 'b', type: 'import' });
      graph.addEdge({ from: 'a', to: 'c', type: 'import' });
      graph.addEdge({ from: 'b', to: 'c', type: 'import' });
      const edges = graph.getEdgesFrom('a');
      expect(edges).toHaveLength(2);
      expect(edges.every((e) => e.from === 'a')).toBe(true);
    });

    it('returns empty array when no edges from the given node', () => {
      expect(graph.getEdgesFrom('nonexistent')).toHaveLength(0);
    });
  });

  describe('getEdgesTo()', () => {
    it('returns edges pointing to the given node', () => {
      graph.addEdge({ from: 'a', to: 'c', type: 'import' });
      graph.addEdge({ from: 'b', to: 'c', type: 'import' });
      graph.addEdge({ from: 'a', to: 'b', type: 'import' });
      const edges = graph.getEdgesTo('c');
      expect(edges).toHaveLength(2);
      expect(edges.every((e) => e.to === 'c')).toBe(true);
    });

    it('returns empty array when no edges to the given node', () => {
      expect(graph.getEdgesTo('nonexistent')).toHaveLength(0);
    });
  });
});
