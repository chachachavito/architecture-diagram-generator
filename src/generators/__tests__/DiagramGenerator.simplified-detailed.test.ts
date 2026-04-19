import { DiagramGenerator, DependencyGraph, ClassifiedGraph, GraphNode, ArchitectureLayer } from '../DiagramGenerator';

describe('DiagramGenerator - Simplified and Detailed Modes', () => {
  describe('generateSimplified()', () => {
    it('should generate simplified diagram with aggregated nodes by layer and domain', () => {
      const generator = new DiagramGenerator();
      
      // Create a graph with multiple nodes per domain
      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/page.tsx', { id: 'app/page.tsx', type: 'route', layer: 'UI', domain: 'Dashboard' }],
          ['app/components/Header.tsx', { id: 'app/components/Header.tsx', type: 'component', layer: 'UI', domain: 'Dashboard' }],
          ['app/api/risk/route.ts', { id: 'app/api/risk/route.ts', type: 'api', layer: 'API', domain: 'Risk' }],
          ['app/api/weather/route.ts', { id: 'app/api/weather/route.ts', type: 'api', layer: 'API', domain: 'Weather' }],
          ['lib/risk-calculator.ts', { id: 'lib/risk-calculator.ts', type: 'utility', layer: 'Processing', domain: 'Risk' }],
          ['lib/weather-service.ts', { id: 'lib/weather-service.ts', type: 'utility', layer: 'Processing', domain: 'Weather' }],
        ]),
        edges: [
          { from: 'app/page.tsx', to: 'app/api/risk/route.ts', type: 'import' },
          { from: 'app/api/risk/route.ts', to: 'lib/risk-calculator.ts', type: 'import' },
        ],
        layers: new Map([
          ['UI', [
            { id: 'app/page.tsx', type: 'route', layer: 'UI', domain: 'Dashboard' },
            { id: 'app/components/Header.tsx', type: 'component', layer: 'UI', domain: 'Dashboard' },
          ]],
          ['API', [
            { id: 'app/api/risk/route.ts', type: 'api', layer: 'API', domain: 'Risk' },
            { id: 'app/api/weather/route.ts', type: 'api', layer: 'API', domain: 'Weather' },
          ]],
          ['Processing', [
            { id: 'lib/risk-calculator.ts', type: 'utility', layer: 'Processing', domain: 'Risk' },
            { id: 'lib/weather-service.ts', type: 'utility', layer: 'Processing', domain: 'Weather' },
          ]],
          ['Data', []],
          ['Storage', []],
        ]),
        domains: new Map(),
      };

      const result = generator.generateSimplified(graph);

      expect(result.syntax).toContain('graph LR');
      expect(result.syntax).toContain('subgraph UI');
      expect(result.syntax).toContain('subgraph API');
      expect(result.syntax).toContain('subgraph Processing');
      expect(result.syntax).toContain('Services'); // Processing renamed to Services
      expect(result.metadata.nodeCount).toBeGreaterThan(0);
      expect(result.metadata.edgeCount).toBeGreaterThanOrEqual(0);
    });

    it('should aggregate nodes by domain to reduce node count', () => {
      const generator = new DiagramGenerator();
      
      // Create a graph with many nodes in same domains
      const nodes = new Map<string, GraphNode>();
      const edges = [];
      
      for (let i = 0; i < 50; i++) {
        const layer: ArchitectureLayer = ['UI', 'API', 'Processing', 'Data', 'Storage'][i % 5] as ArchitectureLayer;
        const domain = `Domain${Math.floor(i / 10)}`; // Fewer domains than nodes
        nodes.set(`file${i}.ts`, {
          id: `file${i}.ts`,
          type: 'utility',
          layer,
          domain,
        });
      }

      const graph: ClassifiedGraph = {
        nodes,
        edges,
        layers: new Map([
          ['UI', Array.from(nodes.values()).filter(n => n.layer === 'UI')],
          ['API', Array.from(nodes.values()).filter(n => n.layer === 'API')],
          ['Processing', Array.from(nodes.values()).filter(n => n.layer === 'Processing')],
          ['Data', Array.from(nodes.values()).filter(n => n.layer === 'Data')],
          ['Storage', Array.from(nodes.values()).filter(n => n.layer === 'Storage')],
        ]),
        domains: new Map(),
      };

      const result = generator.generateSimplified(graph);

      // Simplified diagram should have fewer nodes than the original graph
      expect(result.metadata.nodeCount).toBeLessThan(nodes.size);
      // Should still have valid Mermaid syntax
      expect(result.syntax).toContain('graph LR');
      expect(result.syntax).toContain('subgraph');
    });

    it('should show connections between layers, not individual modules', () => {
      const generator = new DiagramGenerator();
      
      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/page.tsx', { id: 'app/page.tsx', type: 'route', layer: 'UI' }],
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api', layer: 'API' }],
          ['lib/util.ts', { id: 'lib/util.ts', type: 'utility', layer: 'Processing' }],
        ]),
        edges: [
          { from: 'app/page.tsx', to: 'app/api/route.ts', type: 'import' },
          { from: 'app/api/route.ts', to: 'lib/util.ts', type: 'import' },
        ],
        layers: new Map([
          ['UI', [{ id: 'app/page.tsx', type: 'route', layer: 'UI' }]],
          ['API', [{ id: 'app/api/route.ts', type: 'api', layer: 'API' }]],
          ['Processing', [{ id: 'lib/util.ts', type: 'utility', layer: 'Processing' }]],
          ['Data', []],
          ['Storage', []],
        ]),
        domains: new Map(),
      };

      const result = generator.generateSimplified(graph);

      // Should have layer-level connections
      expect(result.syntax).toContain('-->');
      expect(result.syntax).toContain('subgraph UI');
      expect(result.syntax).toContain('subgraph API');
    });

    it('should aggregate nodes with same domain into single representative node', () => {
      const generator = new DiagramGenerator();
      
      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/api/risk/route.ts', { id: 'app/api/risk/route.ts', type: 'api', layer: 'API', domain: 'Risk' }],
          ['app/api/risk/validate.ts', { id: 'app/api/risk/validate.ts', type: 'utility', layer: 'API', domain: 'Risk' }],
          ['lib/risk-calc.ts', { id: 'lib/risk-calc.ts', type: 'utility', layer: 'Processing', domain: 'Risk' }],
        ]),
        edges: [],
        layers: new Map([
          ['UI', []],
          ['API', [
            { id: 'app/api/risk/route.ts', type: 'api', layer: 'API', domain: 'Risk' },
            { id: 'app/api/risk/validate.ts', type: 'utility', layer: 'API', domain: 'Risk' },
          ]],
          ['Processing', [
            { id: 'lib/risk-calc.ts', type: 'utility', layer: 'Processing', domain: 'Risk' },
          ]],
          ['Data', []],
          ['Storage', []],
        ]),
        domains: new Map(),
      };

      const result = generator.generateSimplified(graph);

      // Should show aggregated nodes
      expect(result.syntax).toContain('Risk');
      expect(result.syntax).toContain('subgraph API');
    });
  });

  describe('generateDetailed()', () => {
    it('should generate detailed diagram showing all individual modules', () => {
      const generator = new DiagramGenerator();
      
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/page.tsx', { id: 'app/page.tsx', type: 'route' }],
          ['app/components/Header.tsx', { id: 'app/components/Header.tsx', type: 'component' }],
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api' }],
          ['lib/util.ts', { id: 'lib/util.ts', type: 'utility' }],
        ]),
        edges: [
          { from: 'app/page.tsx', to: 'app/components/Header.tsx', type: 'import' },
          { from: 'app/page.tsx', to: 'app/api/route.ts', type: 'import' },
          { from: 'app/api/route.ts', to: 'lib/util.ts', type: 'import' },
        ],
      };

      const result = generator.generateDetailed(graph);

      // Should show all nodes
      expect(result.syntax).toContain('app_page_tsx');
      expect(result.syntax).toContain('app_components_Header_tsx');
      expect(result.syntax).toContain('app_api_route_ts');
      expect(result.syntax).toContain('lib_util_ts');
      
      // Should show all edges
      expect(result.syntax).toContain('-->');
      expect(result.metadata.nodeCount).toBe(4);
      expect(result.metadata.edgeCount).toBe(3);
    });

    it('should show all dependencies between modules', () => {
      const generator = new DiagramGenerator();
      
      const graph: DependencyGraph = {
        nodes: new Map([
          ['module1.ts', { id: 'module1.ts', type: 'utility' }],
          ['module2.ts', { id: 'module2.ts', type: 'utility' }],
          ['module3.ts', { id: 'module3.ts', type: 'utility' }],
        ]),
        edges: [
          { from: 'module1.ts', to: 'module2.ts', type: 'import' },
          { from: 'module2.ts', to: 'module3.ts', type: 'import' },
          { from: 'module1.ts', to: 'module3.ts', type: 'import' },
        ],
      };

      const result = generator.generateDetailed(graph);

      // All edges should be present
      expect(result.metadata.edgeCount).toBe(3);
      expect(result.syntax).toContain('module1_ts --> module2_ts');
      expect(result.syntax).toContain('module2_ts --> module3_ts');
      expect(result.syntax).toContain('module1_ts --> module3_ts');
    });

    it('should use subgraphs for organization by layer and domain', () => {
      const generator = new DiagramGenerator();
      
      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/page.tsx', { id: 'app/page.tsx', type: 'route', layer: 'UI', domain: 'Dashboard' }],
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api', layer: 'API', domain: 'Risk' }],
          ['lib/util.ts', { id: 'lib/util.ts', type: 'utility', layer: 'Processing', domain: 'Risk' }],
        ]),
        edges: [
          { from: 'app/page.tsx', to: 'app/api/route.ts', type: 'import' },
          { from: 'app/api/route.ts', to: 'lib/util.ts', type: 'import' },
        ],
        layers: new Map([
          ['UI', [{ id: 'app/page.tsx', type: 'route', layer: 'UI', domain: 'Dashboard' }]],
          ['API', [{ id: 'app/api/route.ts', type: 'api', layer: 'API', domain: 'Risk' }]],
          ['Processing', [{ id: 'lib/util.ts', type: 'utility', layer: 'Processing', domain: 'Risk' }]],
          ['Data', []],
          ['Storage', []],
        ]),
        domains: new Map(),
      };

      const result = generator.generateDetailed(graph);

      // Should have layer subgraphs
      expect(result.syntax).toContain('subgraph UI');
      expect(result.syntax).toContain('subgraph API');
      expect(result.syntax).toContain('subgraph Processing');
      
      // Should show all nodes
      expect(result.metadata.nodeCount).toBe(3);
    });
  });

  describe('aggregateNodesByLayerAndDomain()', () => {
    it('should create representative nodes for each domain', () => {
      const generator = new DiagramGenerator();
      
      // Access private method through type casting
      const layerGroups = new Map([
        ['UI' as ArchitectureLayer, [
          { id: 'app/page.tsx', type: 'route' as const, layer: 'UI' as ArchitectureLayer, domain: 'Dashboard' },
          { id: 'app/components/Header.tsx', type: 'component' as const, layer: 'UI' as ArchitectureLayer, domain: 'Dashboard' },
        ]],
        ['API' as ArchitectureLayer, [
          { id: 'app/api/risk/route.ts', type: 'api' as const, layer: 'API' as ArchitectureLayer, domain: 'Risk' },
        ]],
      ]);

      const result = (generator as any).aggregateNodesByLayerAndDomain(layerGroups);

      expect(result.size).toBe(2);
      expect(result.get('UI' as ArchitectureLayer)).toHaveLength(1);
      expect(result.get('API' as ArchitectureLayer)).toHaveLength(1);
    });
  });

  describe('extractLayerLevelEdges()', () => {
    it('should extract edges between different layers', () => {
      const generator = new DiagramGenerator();
      
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/page.tsx', { id: 'app/page.tsx', type: 'route', layer: 'UI' }],
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api', layer: 'API' }],
          ['lib/util.ts', { id: 'lib/util.ts', type: 'utility', layer: 'Processing' }],
        ]),
        edges: [
          { from: 'app/page.tsx', to: 'app/api/route.ts', type: 'import' },
          { from: 'app/api/route.ts', to: 'lib/util.ts', type: 'import' },
        ],
      };

      const layerGroups = new Map([
        ['UI' as ArchitectureLayer, [{ id: 'app/page.tsx', type: 'route' as const, layer: 'UI' as ArchitectureLayer }]],
        ['API' as ArchitectureLayer, [{ id: 'app/api/route.ts', type: 'api' as const, layer: 'API' as ArchitectureLayer }]],
        ['Processing' as ArchitectureLayer, [{ id: 'lib/util.ts', type: 'utility' as const, layer: 'Processing' as ArchitectureLayer }]],
      ]);

      const result = (generator as any).extractLayerLevelEdges(graph, layerGroups);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].from).toBe('app/page.tsx');
      expect(result[0].to).toBe('app/api/route.ts');
    });

    it('should avoid duplicate layer edges', () => {
      const generator = new DiagramGenerator();
      
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/page1.tsx', { id: 'app/page1.tsx', type: 'route', layer: 'UI' }],
          ['app/page2.tsx', { id: 'app/page2.tsx', type: 'route', layer: 'UI' }],
          ['app/api/route1.ts', { id: 'app/api/route1.ts', type: 'api', layer: 'API' }],
          ['app/api/route2.ts', { id: 'app/api/route2.ts', type: 'api', layer: 'API' }],
        ]),
        edges: [
          { from: 'app/page1.tsx', to: 'app/api/route1.ts', type: 'import' },
          { from: 'app/page2.tsx', to: 'app/api/route2.ts', type: 'import' },
        ],
      };

      const layerGroups = new Map([
        ['UI' as ArchitectureLayer, [
          { id: 'app/page1.tsx', type: 'route' as const, layer: 'UI' as ArchitectureLayer },
          { id: 'app/page2.tsx', type: 'route' as const, layer: 'UI' as ArchitectureLayer },
        ]],
        ['API' as ArchitectureLayer, [
          { id: 'app/api/route1.ts', type: 'api' as const, layer: 'API' as ArchitectureLayer },
          { id: 'app/api/route2.ts', type: 'api' as const, layer: 'API' as ArchitectureLayer },
        ]],
      ]);

      const result = (generator as any).extractLayerLevelEdges(graph, layerGroups);

      // Should have only one UI->API edge despite multiple individual edges
      const uiToApiEdges = result.filter(e => e.from.includes('page') && e.to.includes('api'));
      expect(uiToApiEdges.length).toBe(1);
    });
  });
});
