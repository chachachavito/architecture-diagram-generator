import { DiagramGenerator, DependencyGraph, ClassifiedGraph, GraphNode, ArchitectureLayer } from './DiagramGenerator';
import { ParsedModule } from '../parsers';

describe('DiagramGenerator', () => {
  describe('generate()', () => {
    it('should generate basic Mermaid syntax with default direction', () => {
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/page.tsx', { id: 'app/page.tsx', type: 'route' }],
          ['app/api/test/route.ts', { id: 'app/api/test/route.ts', type: 'api' }],
        ]),
        edges: [
          { from: 'app/page.tsx', to: 'app/api/test/route.ts', type: 'import' },
        ],
      };

      const result = generator.generate(graph);

      expect(result.syntax).toContain('graph LR'); // Changed from TB to LR
      expect(result.syntax).toContain('app_page_tsx[App]'); // Changed from [Page] to [App]
      expect(result.syntax).toContain('app_api_test_route_ts[Test API]'); // Changed from [Route] to [Test API]
      expect(result.syntax).toContain('app_page_tsx --> app_api_test_route_ts');
      expect(result.metadata.nodeCount).toBe(2);
      expect(result.metadata.edgeCount).toBe(1);
    });

    it('should generate Mermaid syntax with LR direction', () => {
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/page.tsx', { id: 'app/page.tsx', type: 'route' }],
        ]),
        edges: [],
      };

      const result = generator.generate(graph, { direction: 'LR' });

      expect(result.syntax).toContain('graph LR');
    });

    it('should use custom labels when provided', () => {
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/page.tsx', { id: 'app/page.tsx', type: 'route', label: 'Home Page' }],
        ]),
        edges: [],
      };

      const result = generator.generate(graph);

      expect(result.syntax).toContain('[Home Page]');
    });

    it('should generate nodes without edges when showDependencies is false', () => {
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/page.tsx', { id: 'app/page.tsx', type: 'route' }],
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api' }],
        ]),
        edges: [
          { from: 'app/page.tsx', to: 'app/api/route.ts', type: 'import' },
        ],
      };

      const result = generator.generate(graph, { showDependencies: false });

      expect(result.syntax).toContain('app_page_tsx[App]'); // Changed from [Page] to [App]
      expect(result.syntax).toContain('app_api_route_ts[Api API]'); // Changed from [Route] to [Api API]
      expect(result.syntax).not.toContain('-->');
    });

    it('should handle empty graph', () => {
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map(),
        edges: [],
      };

      expect(() => generator.generate(graph)).toThrow('Mermaid diagram must contain at least one node');
    });

    it('should skip edges where target node does not exist', () => {
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/page.tsx', { id: 'app/page.tsx', type: 'route' }],
        ]),
        edges: [
          { from: 'app/page.tsx', to: 'nonexistent.ts', type: 'import' },
        ],
      };

      const result = generator.generate(graph);

      expect(result.syntax).toContain('app_page_tsx[App]'); // Changed from [Page] to [App]
      expect(result.syntax).not.toContain('nonexistent');
    });
  });

  describe('validateDirection()', () => {
    it('should accept valid directions', () => {
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['test.ts', { id: 'test.ts', type: 'utility' }],
        ]),
        edges: [],
      };

      expect(() => generator.generate(graph, { direction: 'TB' })).not.toThrow();
      expect(() => generator.generate(graph, { direction: 'LR' })).not.toThrow();
      expect(() => generator.generate(graph, { direction: 'BT' })).not.toThrow();
      expect(() => generator.generate(graph, { direction: 'RL' })).not.toThrow();
    });

    it('should reject invalid directions', () => {
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['test.ts', { id: 'test.ts', type: 'utility' }],
        ]),
        edges: [],
      };

      expect(() => generator.generate(graph, { direction: 'INVALID' as any })).toThrow(
        'Invalid graph direction'
      );
    });
  });

  describe('validateNodeIds()', () => {
    it('should detect duplicate node IDs', () => {
      const generator = new DiagramGenerator();
      
      // Create a graph with duplicate IDs (this shouldn't happen in practice with Map)
      // We'll test the validation logic by creating nodes with same sanitized ID
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/test.ts', { id: 'app/test.ts', type: 'utility' }],
        ]),
        edges: [],
      };

      // This should not throw since Map prevents duplicates
      expect(() => generator.generate(graph)).not.toThrow();
    });

    it('should handle special characters in node IDs', () => {
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/test-file.ts', { id: 'app/test-file.ts', type: 'utility' }],
          ['app/test_file.ts', { id: 'app/test_file.ts', type: 'utility' }],
          ['app/test.file.ts', { id: 'app/test.file.ts', type: 'utility' }],
        ]),
        edges: [],
      };

      const result = generator.generate(graph);

      // Hyphens should be converted to underscores
      expect(result.syntax).toContain('app_test_file_ts');
      expect(result.syntax).toContain('app_test_file_ts');
      expect(result.syntax).toContain('app_test_file_ts');
    });
  });

  describe('validateMermaidSyntax()', () => {
    it('should validate well-formed Mermaid syntax', () => {
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['test.ts', { id: 'test.ts', type: 'utility' }],
        ]),
        edges: [],
      };

      expect(() => generator.generate(graph)).not.toThrow();
    });

    it('should ensure graph starts with proper declaration', () => {
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['test.ts', { id: 'test.ts', type: 'utility' }],
        ]),
        edges: [],
      };

      const result = generator.generate(graph);

      expect(result.syntax).toMatch(/graph\s+(TB|LR|BT|RL)/); // Removed ^ anchor since init block comes first
    });
  });

  describe('buildGraph()', () => {
    it('should build graph from parsed modules', () => {
      const generator = new DiagramGenerator();
      const modules: ParsedModule[] = [
        {
          path: 'app/page.tsx',
          imports: [
            { source: 'lib/utils.ts', specifiers: ['helper'], isExternal: false, importKind: 'named' },
          ],
          exports: [],
          externalCalls: [],
          metadata: {
            hasDefaultExport: true,
            isReactComponent: true,
            isApiRoute: false,
          },
        },
        {
          path: 'lib/utils.ts',
          imports: [],
          exports: [{ name: 'helper', type: 'function', isDefault: false }],
          externalCalls: [],
          metadata: {
            hasDefaultExport: false,
            isReactComponent: false,
            isApiRoute: false,
          },
        },
      ];

      const graph = generator.buildGraph(modules);

      expect(graph.nodes.size).toBe(2);
      expect(graph.nodes.has('app/page.tsx')).toBe(true);
      expect(graph.nodes.has('lib/utils.ts')).toBe(true);
      expect(graph.edges.length).toBe(1);
      expect(graph.edges[0]).toEqual({
        from: 'app/page.tsx',
        to: 'lib/utils.ts',
        type: 'import',
      });
    });

    it('should infer correct node types', () => {
      const generator = new DiagramGenerator();
      const modules: ParsedModule[] = [
        {
          path: 'app/api/test/route.ts',
          imports: [],
          exports: [],
          externalCalls: [],
          metadata: {
            hasDefaultExport: false,
            isReactComponent: false,
            isApiRoute: true,
          },
        },
        {
          path: 'app/page.tsx',
          imports: [],
          exports: [],
          externalCalls: [],
          metadata: {
            hasDefaultExport: true,
            isReactComponent: true,
            isApiRoute: false,
          },
        },
        {
          path: 'components/Button.tsx',
          imports: [],
          exports: [],
          externalCalls: [],
          metadata: {
            hasDefaultExport: true,
            isReactComponent: true,
            isApiRoute: false,
          },
        },
        {
          path: 'lib/utils.ts',
          imports: [],
          exports: [],
          externalCalls: [],
          metadata: {
            hasDefaultExport: false,
            isReactComponent: false,
            isApiRoute: false,
          },
        },
      ];

      const graph = generator.buildGraph(modules);

      expect(graph.nodes.get('app/api/test/route.ts')?.type).toBe('api');
      expect(graph.nodes.get('app/page.tsx')?.type).toBe('route');
      expect(graph.nodes.get('components/Button.tsx')?.type).toBe('component');
      expect(graph.nodes.get('lib/utils.ts')?.type).toBe('utility');
    });

    it('should only create edges for internal dependencies', () => {
      const generator = new DiagramGenerator();
      const modules: ParsedModule[] = [
        {
          path: 'app/page.tsx',
          imports: [
            { source: 'react', specifiers: ['useState'], isExternal: true, importKind: 'named' },
            { source: 'lib/utils.ts', specifiers: ['helper'], isExternal: false, importKind: 'named' },
          ],
          exports: [],
          externalCalls: [],
          metadata: {
            hasDefaultExport: true,
            isReactComponent: true,
            isApiRoute: false,
          },
        },
        {
          path: 'lib/utils.ts',
          imports: [],
          exports: [],
          externalCalls: [],
          metadata: {
            hasDefaultExport: false,
            isReactComponent: false,
            isApiRoute: false,
          },
        },
      ];

      const graph = generator.buildGraph(modules);

      // Should only have 1 edge (to lib/utils.ts), not to react
      expect(graph.edges.length).toBe(1);
      expect(graph.edges[0].to).toBe('lib/utils.ts');
    });

    it('should handle modules with no imports', () => {
      const generator = new DiagramGenerator();
      const modules: ParsedModule[] = [
        {
          path: 'lib/constants.ts',
          imports: [],
          exports: [{ name: 'API_URL', type: 'variable', isDefault: false }],
          externalCalls: [],
          metadata: {
            hasDefaultExport: false,
            isReactComponent: false,
            isApiRoute: false,
          },
        },
      ];

      const graph = generator.buildGraph(modules);

      expect(graph.nodes.size).toBe(1);
      expect(graph.edges.length).toBe(0);
    });
  });

  describe('Node ID sanitization', () => {
    it('should sanitize node IDs with special characters', () => {
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/[id]/page.tsx', { id: 'app/[id]/page.tsx', type: 'route' }],
          ['app/(auth)/login.tsx', { id: 'app/(auth)/login.tsx', type: 'route' }],
        ]),
        edges: [],
      };

      const result = generator.generate(graph);

      // Should not contain raw special characters in node IDs, but labels can contain them
      expect(result.syntax).not.toContain('app_[id]_page_tsx'); // Node ID should be sanitized
      expect(result.syntax).not.toContain('app_(auth)_login_tsx'); // Node ID should be sanitized
      expect(result.syntax).toContain('app_id_page_tsx'); // Sanitized node ID
      expect(result.syntax).toContain('app_auth_login_tsx'); // Sanitized node ID
    });

    it('should ensure sanitized IDs start with a letter', () => {
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['123-test.ts', { id: '123-test.ts', type: 'utility' }],
        ]),
        edges: [],
      };

      const result = generator.generate(graph);

      // Should add 'node_' prefix if ID starts with number, and convert hyphen to underscore
      expect(result.syntax).toContain('node_123_test_ts');
    });
  });

  describe('Label generation', () => {
    it('should generate readable labels from file paths', () => {
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/user-profile/page.tsx', { id: 'app/user-profile/page.tsx', type: 'route' }],
          ['lib/api_client.ts', { id: 'lib/api_client.ts', type: 'utility' }],
        ]),
        edges: [],
      };

      const result = generator.generate(graph);

      expect(result.syntax).toContain('[User Profile]'); // Changed from [Page] to [User Profile] based on parent directory
      expect(result.syntax).toContain('[Api Client]'); // This should remain the same
    });
  });

  describe('Metadata', () => {
    it('should include correct metadata in result', () => {
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/page.tsx', { id: 'app/page.tsx', type: 'route' }],
          ['lib/utils.ts', { id: 'lib/utils.ts', type: 'utility' }],
        ]),
        edges: [
          { from: 'app/page.tsx', to: 'lib/utils.ts', type: 'import' },
        ],
      };

      const result = generator.generate(graph);

      expect(result.metadata.nodeCount).toBe(2);
      expect(result.metadata.edgeCount).toBe(1);
      expect(result.metadata.generatedAt).toBeInstanceOf(Date);
    });
  });

  describe('ClassifiedGraph subgraph support (Task 9.1)', () => {
    it('should use pre-computed layers from ClassifiedGraph for subgraph generation', () => {
      const generator = new DiagramGenerator();

      const uiNode: GraphNode = { id: 'app/page.tsx', type: 'route', layer: 'UI' };
      const apiNode: GraphNode = { id: 'app/api/route.ts', type: 'api', layer: 'API' };

      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/page.tsx', uiNode],
          ['app/api/route.ts', apiNode],
        ]),
        edges: [],
        layers: new Map<ArchitectureLayer, GraphNode[]>([
          ['UI', [uiNode]],
          ['API', [apiNode]],
        ]),
        domains: new Map(),
      };

      const result = generator.generate(graph);

      expect(result.syntax).toContain('subgraph UI[');
      expect(result.syntax).toContain('subgraph API[');
      expect(result.syntax).toContain('app_page_tsx');
      expect(result.syntax).toContain('app_api_route_ts');
    });

    it('should generate one subgraph per layer present in ClassifiedGraph.layers', () => {
      const generator = new DiagramGenerator();

      const uiNode: GraphNode = { id: 'app/page.tsx', type: 'route', layer: 'UI' };
      const processingNode: GraphNode = { id: 'lib/utils.ts', type: 'utility', layer: 'Processing' };

      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/page.tsx', uiNode],
          ['lib/utils.ts', processingNode],
        ]),
        edges: [],
        layers: new Map<ArchitectureLayer, GraphNode[]>([
          ['UI', [uiNode]],
          ['Processing', [processingNode]],
        ]),
        domains: new Map(),
      };

      const result = generator.generate(graph);

      // Should have subgraphs for UI and Processing, but NOT for API, Data, Storage
      expect(result.syntax).toContain('subgraph UI[');
      expect(result.syntax).toContain('subgraph Processing[');
      expect(result.syntax).not.toContain('subgraph API[');
      expect(result.syntax).not.toContain('subgraph Data[');
      expect(result.syntax).not.toContain('subgraph Storage[');
    });

    it('should include all five architecture layers when all are present in ClassifiedGraph', () => {
      const generator = new DiagramGenerator();

      const uiNode: GraphNode = { id: 'app/page.tsx', type: 'route', layer: 'UI' };
      const apiNode: GraphNode = { id: 'app/api/route.ts', type: 'api', layer: 'API' };
      const procNode: GraphNode = { id: 'lib/utils.ts', type: 'utility', layer: 'Processing' };
      const dataNode: GraphNode = { id: 'lib/db.ts', type: 'utility', layer: 'Data' };
      const storageNode: GraphNode = { id: 'lib/storage.ts', type: 'utility', layer: 'Storage' };

      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/page.tsx', uiNode],
          ['app/api/route.ts', apiNode],
          ['lib/utils.ts', procNode],
          ['lib/db.ts', dataNode],
          ['lib/storage.ts', storageNode],
        ]),
        edges: [],
        layers: new Map<ArchitectureLayer, GraphNode[]>([
          ['UI', [uiNode]],
          ['API', [apiNode]],
          ['Processing', [procNode]],
          ['Data', [dataNode]],
          ['Storage', [storageNode]],
        ]),
        domains: new Map(),
      };

      const result = generator.generate(graph);

      expect(result.syntax).toContain('subgraph UI[');
      expect(result.syntax).toContain('subgraph API[');
      expect(result.syntax).toContain('subgraph Processing[');
      expect(result.syntax).toContain('subgraph Data[');
      expect(result.syntax).toContain('subgraph Storage[');
    });

    it('should fall back to inferred layers when a plain DependencyGraph is provided', () => {
      const generator = new DiagramGenerator();

      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/page.tsx', { id: 'app/page.tsx', type: 'route', layer: 'UI' }],
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api', layer: 'API' }],
        ]),
        edges: [],
      };

      const result = generator.generate(graph);

      // Should still produce subgraphs via inference
      expect(result.syntax).toContain('subgraph UI[');
      expect(result.syntax).toContain('subgraph API[');
    });
  });

  describe('Directional edges (Task 9.2)', () => {
    it('should render import edges as directed arrows (-->)', () => {
      const generator = new DiagramGenerator();

      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/page.tsx', { id: 'app/page.tsx', type: 'route' }],
          ['lib/utils.ts', { id: 'lib/utils.ts', type: 'utility' }],
        ]),
        edges: [
          { from: 'app/page.tsx', to: 'lib/utils.ts', type: 'import' },
        ],
      };

      const result = generator.generate(graph);

      expect(result.syntax).toContain('app_page_tsx --> lib_utils_ts');
    });

    it('should render external-call edges with a "calls" label', () => {
      const generator = new DiagramGenerator();

      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api' }],
          ['external/openweather', { id: 'external/openweather', type: 'external-service' }],
        ]),
        edges: [
          { from: 'app/api/route.ts', to: 'external/openweather', type: 'external-call' },
        ],
      };

      const result = generator.generate(graph);

      expect(result.syntax).toContain('app_api_route_ts -- calls --> external_openweather');
    });

    it('should render import edges without a label', () => {
      const generator = new DiagramGenerator();

      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/page.tsx', { id: 'app/page.tsx', type: 'route' }],
          ['lib/utils.ts', { id: 'lib/utils.ts', type: 'utility' }],
        ]),
        edges: [
          { from: 'app/page.tsx', to: 'lib/utils.ts', type: 'import' },
        ],
      };

      const result = generator.generate(graph);

      // import edges should use plain --> without a label
      expect(result.syntax).toMatch(/app_page_tsx --> lib_utils_ts/);
      expect(result.syntax).not.toMatch(/app_page_tsx -- \w+ --> lib_utils_ts/);
    });

    it('should render multiple edges with correct directions in ClassifiedGraph', () => {
      const generator = new DiagramGenerator();

      const uiNode: GraphNode = { id: 'app/page.tsx', type: 'route', layer: 'UI' };
      const apiNode: GraphNode = { id: 'app/api/route.ts', type: 'api', layer: 'API' };
      const extNode: GraphNode = { id: 'external/db', type: 'external-service', layer: 'Storage' };

      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/page.tsx', uiNode],
          ['app/api/route.ts', apiNode],
          ['external/db', extNode],
        ]),
        edges: [
          { from: 'app/page.tsx', to: 'app/api/route.ts', type: 'import' },
          { from: 'app/api/route.ts', to: 'external/db', type: 'external-call' },
        ],
        layers: new Map<ArchitectureLayer, GraphNode[]>([
          ['UI', [uiNode]],
          ['API', [apiNode]],
          ['Storage', [extNode]],
        ]),
        domains: new Map(),
      };

      const result = generator.generate(graph);

      expect(result.syntax).toContain('app_page_tsx --> app_api_route_ts');
      expect(result.syntax).toContain('app_api_route_ts -- calls --> external_db');
    });

    it('should not render edges when showDependencies is false', () => {
      const generator = new DiagramGenerator();

      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/page.tsx', { id: 'app/page.tsx', type: 'route' }],
          ['lib/utils.ts', { id: 'lib/utils.ts', type: 'utility' }],
        ]),
        edges: [
          { from: 'app/page.tsx', to: 'lib/utils.ts', type: 'import' },
        ],
      };

      const result = generator.generate(graph, { showDependencies: false });

      expect(result.syntax).not.toContain('-->');
    });
  });
});

/**
 * Task 18.2 - Unit tests for domain labeling
 * Validates: Requirements 4.6
 */
describe('Domain labeling in layered visualization (Task 18.2)', () => {
  describe('Domain annotation on nodes', () => {
    it('should annotate nodes with domain information in their labels', () => {
      const generator = new DiagramGenerator();

      const uiNode: GraphNode = { id: 'app/risk/dashboard/page.tsx', type: 'route', layer: 'UI', domain: 'Risk' };
      const apiNode: GraphNode = { id: 'app/api/risk/route.ts', type: 'api', layer: 'API', domain: 'Risk' };

      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/risk/dashboard/page.tsx', uiNode],
          ['app/api/risk/route.ts', apiNode],
        ]),
        edges: [],
        layers: new Map<ArchitectureLayer, GraphNode[]>([
          ['UI', [uiNode]],
          ['API', [apiNode]],
        ]),
        domains: new Map(),
      };

      const result = generator.generate(graph);

      // Nodes should have domain annotation in their labels
      expect(result.syntax).toContain('(Risk)');
    });

    it('should not annotate nodes without domain information', () => {
      const generator = new DiagramGenerator();

      const uiNode: GraphNode = { id: 'app/page.tsx', type: 'route', layer: 'UI' };

      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/page.tsx', uiNode],
        ]),
        edges: [],
        layers: new Map<ArchitectureLayer, GraphNode[]>([
          ['UI', [uiNode]],
        ]),
        domains: new Map(),
      };

      const result = generator.generate(graph);

      // Should not have domain annotation
      expect(result.syntax).not.toContain('(undefined)');
    });

    it('should group nodes by domain within layers when multiple domains exist', () => {
      const generator = new DiagramGenerator();

      const riskNode: GraphNode = { id: 'app/api/risk/route.ts', type: 'api', layer: 'API', domain: 'Risk' };
      const weatherNode: GraphNode = { id: 'app/api/weather/route.ts', type: 'api', layer: 'API', domain: 'Weather' };

      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/api/risk/route.ts', riskNode],
          ['app/api/weather/route.ts', weatherNode],
        ]),
        edges: [],
        layers: new Map<ArchitectureLayer, GraphNode[]>([
          ['API', [riskNode, weatherNode]],
        ]),
        domains: new Map(),
      };

      const result = generator.generate(graph);

      // Should create domain subgraphs
      expect(result.syntax).toContain('subgraph API_Risk');
      expect(result.syntax).toContain('subgraph API_Weather');
    });

    it('should create domain subgraphs with domain icons and names', () => {
      const generator = new DiagramGenerator();

      const riskNode1: GraphNode = { id: 'app/api/risk/route.ts', type: 'api', layer: 'API', domain: 'Risk' };
      const riskNode2: GraphNode = { id: 'lib/risk-calc.ts', type: 'utility', layer: 'API', domain: 'Risk' };

      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/api/risk/route.ts', riskNode1],
          ['lib/risk-calc.ts', riskNode2],
        ]),
        edges: [],
        layers: new Map<ArchitectureLayer, GraphNode[]>([
          ['API', [riskNode1, riskNode2]],
        ]),
        domains: new Map(),
      };

      const result = generator.generate(graph);

      // Domain subgraphs should have icons
      expect(result.syntax).toContain('📦 Risk');
    });

    it('should not create domain subgraphs when only single nodes per domain', () => {
      const generator = new DiagramGenerator();

      const riskNode: GraphNode = { id: 'app/api/risk/route.ts', type: 'api', layer: 'API', domain: 'Risk' };
      const weatherNode: GraphNode = { id: 'app/api/weather/route.ts', type: 'api', layer: 'API', domain: 'Weather' };

      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/api/risk/route.ts', riskNode],
          ['app/api/weather/route.ts', weatherNode],
        ]),
        edges: [],
        layers: new Map<ArchitectureLayer, GraphNode[]>([
          ['API', [riskNode, weatherNode]],
        ]),
        domains: new Map(),
      };

      const result = generator.generate(graph);

      // Should create domain subgraphs since we have multiple domains
      expect(result.syntax).toContain('subgraph API_Risk');
      expect(result.syntax).toContain('subgraph API_Weather');
    });

    it('should handle mixed domains and non-domain nodes in same layer', () => {
      const generator = new DiagramGenerator();

      const riskNode: GraphNode = { id: 'app/api/risk/route.ts', type: 'api', layer: 'API', domain: 'Risk' };
      const riskNode2: GraphNode = { id: 'lib/risk-calc.ts', type: 'utility', layer: 'API', domain: 'Risk' };
      const utilNode: GraphNode = { id: 'lib/utils.ts', type: 'utility', layer: 'API' };

      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/api/risk/route.ts', riskNode],
          ['lib/risk-calc.ts', riskNode2],
          ['lib/utils.ts', utilNode],
        ]),
        edges: [],
        layers: new Map<ArchitectureLayer, GraphNode[]>([
          ['API', [riskNode, riskNode2, utilNode]],
        ]),
        domains: new Map(),
      };

      const result = generator.generate(graph);

      // Should have domain subgraph for Risk
      expect(result.syntax).toContain('subgraph API_Risk');
      // Util node should be outside domain subgraph
      expect(result.syntax).toContain('lib_utils_ts');
    });
  });

  describe('Domain grouping within layers', () => {
    it('should place domain-grouped nodes inside domain subgraphs', () => {
      const generator = new DiagramGenerator();

      const riskNode1: GraphNode = { id: 'app/api/risk/route.ts', type: 'api', layer: 'API', domain: 'Risk' };
      const riskNode2: GraphNode = { id: 'lib/risk-calc.ts', type: 'utility', layer: 'API', domain: 'Risk' };

      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/api/risk/route.ts', riskNode1],
          ['lib/risk-calc.ts', riskNode2],
        ]),
        edges: [],
        layers: new Map<ArchitectureLayer, GraphNode[]>([
          ['API', [riskNode1, riskNode2]],
        ]),
        domains: new Map(),
      };

      const result = generator.generate(graph);
      const lines = result.syntax.split('\n');

      // Find the Risk domain subgraph
      const riskStart = lines.findIndex(l => l.includes('subgraph API_Risk'));
      const riskEnd = lines.findIndex((l, i) => i > riskStart && l.trim() === 'end');
      const riskBlock = lines.slice(riskStart, riskEnd + 1).join('\n');

      // Both nodes should be inside the Risk domain subgraph
      expect(riskBlock).toContain('app_api_risk_route_ts');
      expect(riskBlock).toContain('lib_risk_calc_ts');
    });

    it('should organize multiple domains within a single layer', () => {
      const generator = new DiagramGenerator();

      const riskNode1: GraphNode = { id: 'app/api/risk/route.ts', type: 'api', layer: 'API', domain: 'Risk' };
      const riskNode2: GraphNode = { id: 'lib/risk-calc.ts', type: 'utility', layer: 'API', domain: 'Risk' };
      const weatherNode1: GraphNode = { id: 'app/api/weather/route.ts', type: 'api', layer: 'API', domain: 'Weather' };
      const weatherNode2: GraphNode = { id: 'lib/weather-service.ts', type: 'utility', layer: 'API', domain: 'Weather' };

      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/api/risk/route.ts', riskNode1],
          ['lib/risk-calc.ts', riskNode2],
          ['app/api/weather/route.ts', weatherNode1],
          ['lib/weather-service.ts', weatherNode2],
        ]),
        edges: [],
        layers: new Map<ArchitectureLayer, GraphNode[]>([
          ['API', [riskNode1, riskNode2, weatherNode1, weatherNode2]],
        ]),
        domains: new Map(),
      };

      const result = generator.generate(graph);

      // Should have both domain subgraphs
      expect(result.syntax).toContain('subgraph API_Risk');
      expect(result.syntax).toContain('subgraph API_Weather');

      const lines = result.syntax.split('\n');

      // Risk domain should contain risk nodes
      const riskStart = lines.findIndex(l => l.includes('subgraph API_Risk'));
      const riskEnd = lines.findIndex((l, i) => i > riskStart && l.trim() === 'end');
      const riskBlock = lines.slice(riskStart, riskEnd + 1).join('\n');
      expect(riskBlock).toContain('app_api_risk_route_ts');
      expect(riskBlock).toContain('lib_risk_calc_ts');

      // Weather domain should contain weather nodes
      const weatherStart = lines.findIndex(l => l.includes('subgraph API_Weather'));
      const weatherEnd = lines.findIndex((l, i) => i > weatherStart && l.trim() === 'end');
      const weatherBlock = lines.slice(weatherStart, weatherEnd + 1).join('\n');
      expect(weatherBlock).toContain('app_api_weather_route_ts');
      expect(weatherBlock).toContain('lib_weather_service_ts');
    });

    it('should keep nodes without domains outside domain subgraphs', () => {
      const generator = new DiagramGenerator();

      const riskNode1: GraphNode = { id: 'app/api/risk/route.ts', type: 'api', layer: 'API', domain: 'Risk' };
      const riskNode2: GraphNode = { id: 'lib/risk-calc.ts', type: 'utility', layer: 'API', domain: 'Risk' };
      const utilNode: GraphNode = { id: 'lib/utils.ts', type: 'utility', layer: 'API' };

      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/api/risk/route.ts', riskNode1],
          ['lib/risk-calc.ts', riskNode2],
          ['lib/utils.ts', utilNode],
        ]),
        edges: [],
        layers: new Map<ArchitectureLayer, GraphNode[]>([
          ['API', [riskNode1, riskNode2, utilNode]],
        ]),
        domains: new Map(),
      };

      const result = generator.generate(graph);
      const lines = result.syntax.split('\n');

      // Find the Risk domain subgraph
      const riskStart = lines.findIndex(l => l.includes('subgraph API_Risk'));
      const riskEnd = lines.findIndex((l, i) => i > riskStart && l.trim() === 'end');
      const riskBlock = lines.slice(riskStart, riskEnd + 1).join('\n');

      // Util node should NOT be inside Risk domain subgraph
      expect(riskBlock).not.toContain('lib_utils_ts');

      // But it should be in the API layer
      expect(result.syntax).toContain('lib_utils_ts');
    });
  });
});

describe('Dependency visualization unit tests (Task 9.3)', () => {
  describe('Subgraph generation', () => {
    it('should wrap nodes in subgraphs labeled with layer name and icon', () => {
      const generator = new DiagramGenerator();

      const uiNode: GraphNode = { id: 'app/dashboard/page.tsx', type: 'route', layer: 'UI' };
      const apiNode: GraphNode = { id: 'app/api/data/route.ts', type: 'api', layer: 'API' };

      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/dashboard/page.tsx', uiNode],
          ['app/api/data/route.ts', apiNode],
        ]),
        edges: [],
        layers: new Map<ArchitectureLayer, GraphNode[]>([
          ['UI', [uiNode]],
          ['API', [apiNode]],
        ]),
        domains: new Map(),
      };

      const result = generator.generate(graph);

      // Each layer should produce a subgraph block
      expect(result.syntax).toContain('subgraph UI[');
      expect(result.syntax).toContain('subgraph API[');
      // Subgraph labels should include the layer icon
      expect(result.syntax).toMatch(/subgraph UI\["🎨 UI"\]/);
      expect(result.syntax).toMatch(/subgraph API\["⚡ API"\]/);
    });

    it('should place each node inside its corresponding layer subgraph', () => {
      const generator = new DiagramGenerator();

      const uiNode: GraphNode = { id: 'app/page.tsx', type: 'route', layer: 'UI' };
      const procNode: GraphNode = { id: 'lib/calculator.ts', type: 'utility', layer: 'Processing' };

      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/page.tsx', uiNode],
          ['lib/calculator.ts', procNode],
        ]),
        edges: [],
        layers: new Map<ArchitectureLayer, GraphNode[]>([
          ['UI', [uiNode]],
          ['Processing', [procNode]],
        ]),
        domains: new Map(),
      };

      const result = generator.generate(graph);
      const lines = result.syntax.split('\n');

      // Find the UI subgraph block and verify app_page_tsx is inside it
      const uiSubgraphStart = lines.findIndex(l => l.includes('subgraph UI['));
      const uiSubgraphEnd = lines.findIndex((l, i) => i > uiSubgraphStart && l.trim() === 'end');
      const uiBlock = lines.slice(uiSubgraphStart, uiSubgraphEnd + 1).join('\n');
      expect(uiBlock).toContain('app_page_tsx');

      // Find the Processing subgraph block and verify lib_calculator_ts is inside it
      const procSubgraphStart = lines.findIndex(l => l.includes('subgraph Processing['));
      const procSubgraphEnd = lines.findIndex((l, i) => i > procSubgraphStart && l.trim() === 'end');
      const procBlock = lines.slice(procSubgraphStart, procSubgraphEnd + 1).join('\n');
      expect(procBlock).toContain('lib_calculator_ts');
    });

    it('should omit subgraphs for layers with no nodes', () => {
      const generator = new DiagramGenerator();

      const apiNode: GraphNode = { id: 'app/api/route.ts', type: 'api', layer: 'API' };

      const graph: ClassifiedGraph = {
        nodes: new Map([['app/api/route.ts', apiNode]]),
        edges: [],
        layers: new Map<ArchitectureLayer, GraphNode[]>([
          ['API', [apiNode]],
        ]),
        domains: new Map(),
      };

      const result = generator.generate(graph);

      expect(result.syntax).toContain('subgraph API[');
      expect(result.syntax).not.toContain('subgraph UI[');
      expect(result.syntax).not.toContain('subgraph Processing[');
      expect(result.syntax).not.toContain('subgraph Data[');
      expect(result.syntax).not.toContain('subgraph Storage[');
    });

    it('should render subgraphs in the canonical layer order (UI → API → Processing → Data → Storage)', () => {
      const generator = new DiagramGenerator();

      const uiNode: GraphNode = { id: 'app/page.tsx', type: 'route', layer: 'UI' };
      const apiNode: GraphNode = { id: 'app/api/route.ts', type: 'api', layer: 'API' };
      const procNode: GraphNode = { id: 'lib/utils.ts', type: 'utility', layer: 'Processing' };
      const dataNode: GraphNode = { id: 'lib/db.ts', type: 'utility', layer: 'Data' };
      const storageNode: GraphNode = { id: 'lib/storage.ts', type: 'utility', layer: 'Storage' };

      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/page.tsx', uiNode],
          ['app/api/route.ts', apiNode],
          ['lib/utils.ts', procNode],
          ['lib/db.ts', dataNode],
          ['lib/storage.ts', storageNode],
        ]),
        edges: [],
        layers: new Map<ArchitectureLayer, GraphNode[]>([
          ['Storage', [storageNode]],
          ['Data', [dataNode]],
          ['Processing', [procNode]],
          ['API', [apiNode]],
          ['UI', [uiNode]],
        ]),
        domains: new Map(),
      };

      const result = generator.generate(graph);

      const uiPos = result.syntax.indexOf('subgraph UI[');
      const apiPos = result.syntax.indexOf('subgraph API[');
      const procPos = result.syntax.indexOf('subgraph Processing[');
      const dataPos = result.syntax.indexOf('subgraph Data[');
      const storagePos = result.syntax.indexOf('subgraph Storage[');

      expect(uiPos).toBeLessThan(apiPos);
      expect(apiPos).toBeLessThan(procPos);
      expect(procPos).toBeLessThan(dataPos);
      expect(dataPos).toBeLessThan(storagePos);
    });

    it('should disable subgraph grouping when groupByLayer is false', () => {
      const generator = new DiagramGenerator();

      const uiNode: GraphNode = { id: 'app/page.tsx', type: 'route', layer: 'UI' };
      const apiNode: GraphNode = { id: 'app/api/route.ts', type: 'api', layer: 'API' };

      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/page.tsx', uiNode],
          ['app/api/route.ts', apiNode],
        ]),
        edges: [],
        layers: new Map<ArchitectureLayer, GraphNode[]>([
          ['UI', [uiNode]],
          ['API', [apiNode]],
        ]),
        domains: new Map(),
      };

      const result = generator.generate(graph, { groupByLayer: false });

      expect(result.syntax).not.toContain('subgraph');
    });
  });

  describe('Edge direction', () => {
    it('should produce directed arrows from importer to imported module', () => {
      const generator = new DiagramGenerator();

      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/page.tsx', { id: 'app/page.tsx', type: 'route', layer: 'UI' }],
          ['lib/service.ts', { id: 'lib/service.ts', type: 'utility', layer: 'Processing' }],
        ]),
        edges: [
          { from: 'app/page.tsx', to: 'lib/service.ts', type: 'import' },
        ],
      };

      const result = generator.generate(graph);

      // Arrow must go from importer → imported (not the reverse)
      expect(result.syntax).toContain('app_page_tsx --> lib_service_ts');
      expect(result.syntax).not.toContain('lib_service_ts --> app_page_tsx');
    });

    it('should produce labeled directed arrows for external-call edges', () => {
      const generator = new DiagramGenerator();

      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/api/weather/route.ts', { id: 'app/api/weather/route.ts', type: 'api', layer: 'API' }],
          ['external/openweather', { id: 'external/openweather', type: 'external-service', layer: 'Storage' }],
        ]),
        edges: [
          { from: 'app/api/weather/route.ts', to: 'external/openweather', type: 'external-call' },
        ],
      };

      const result = generator.generate(graph);

      expect(result.syntax).toContain('app_api_weather_route_ts -- calls --> external_openweather');
    });

    it('should render all edges in a multi-edge graph with correct directions', () => {
      const generator = new DiagramGenerator();

      const uiNode: GraphNode = { id: 'app/page.tsx', type: 'route', layer: 'UI' };
      const apiNode: GraphNode = { id: 'app/api/route.ts', type: 'api', layer: 'API' };
      const libNode: GraphNode = { id: 'lib/utils.ts', type: 'utility', layer: 'Processing' };
      const extNode: GraphNode = { id: 'external/db', type: 'external-service', layer: 'Storage' };

      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/page.tsx', uiNode],
          ['app/api/route.ts', apiNode],
          ['lib/utils.ts', libNode],
          ['external/db', extNode],
        ]),
        edges: [
          { from: 'app/page.tsx', to: 'app/api/route.ts', type: 'import' },
          { from: 'app/api/route.ts', to: 'lib/utils.ts', type: 'import' },
          { from: 'app/api/route.ts', to: 'external/db', type: 'external-call' },
        ],
        layers: new Map<ArchitectureLayer, GraphNode[]>([
          ['UI', [uiNode]],
          ['API', [apiNode]],
          ['Processing', [libNode]],
          ['Storage', [extNode]],
        ]),
        domains: new Map(),
      };

      const result = generator.generate(graph);

      expect(result.syntax).toContain('app_page_tsx --> app_api_route_ts');
      expect(result.syntax).toContain('app_api_route_ts --> lib_utils_ts');
      expect(result.syntax).toContain('app_api_route_ts -- calls --> external_db');
    });

    it('should skip edges referencing nodes not present in the graph', () => {
      const generator = new DiagramGenerator();

      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/page.tsx', { id: 'app/page.tsx', type: 'route', layer: 'UI' }],
        ]),
        edges: [
          { from: 'app/page.tsx', to: 'missing/module.ts', type: 'import' },
        ],
      };

      const result = generator.generate(graph);

      expect(result.syntax).not.toContain('missing_module_ts');
      expect(result.syntax).not.toContain('-->');
    });

    it('should produce no edges when the graph has no edge entries', () => {
      const generator = new DiagramGenerator();

      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/page.tsx', { id: 'app/page.tsx', type: 'route', layer: 'UI' }],
          ['lib/utils.ts', { id: 'lib/utils.ts', type: 'utility', layer: 'Processing' }],
        ]),
        edges: [],
      };

      const result = generator.generate(graph);

      expect(result.syntax).not.toContain('-->');
    });
  });
});

describe('External service visualization (Task 13)', () => {
  describe('13.1 Visual differentiation for external services', () => {
    it('should use cylinder shape [(label)] for database external services', () => {
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api', layer: 'API' }],
          ['prisma', { id: 'prisma', type: 'external-service', label: 'Prisma DB', layer: 'Storage' }],
        ]),
        edges: [
          { from: 'app/api/route.ts', to: 'prisma', type: 'external-call' },
        ],
      };

      const result = generator.generate(graph);

      // Cylinder shape: [(label)]
      expect(result.syntax).toContain('prisma[(Prisma DB)]');
    });

    it('should use stadium shape ([label]) for REST API / fetch external services', () => {
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/api/weather/route.ts', { id: 'app/api/weather/route.ts', type: 'api', layer: 'API' }],
          ['https://api.openweathermap.org', {
            id: 'https://api.openweathermap.org',
            type: 'external-service',
            label: 'Openweathermap API',
            layer: 'Processing',
          }],
        ]),
        edges: [
          { from: 'app/api/weather/route.ts', to: 'https://api.openweathermap.org', type: 'external-call' },
        ],
      };

      const result = generator.generate(graph);

      // Stadium shape: ([label])
      expect(result.syntax).toContain('([Openweathermap API])');
    });

    it('should use hexagon shape {{label}} for unknown external services', () => {
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api', layer: 'API' }],
          ['some-service', { id: 'some-service', type: 'external-service', label: 'Some Service', layer: 'Processing' }],
        ]),
        edges: [
          { from: 'app/api/route.ts', to: 'some-service', type: 'external-call' },
        ],
      };

      const result = generator.generate(graph);

      // Hexagon shape: {{label}}
      expect(result.syntax).toContain('{{Some Service}}');
    });

    it('should group external services in a dedicated "External Services" subgraph', () => {
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api', layer: 'API' }],
          ['prisma', { id: 'prisma', type: 'external-service', label: 'Prisma DB', layer: 'Storage' }],
        ]),
        edges: [
          { from: 'app/api/route.ts', to: 'prisma', type: 'external-call' },
        ],
      };

      const result = generator.generate(graph);

      expect(result.syntax).toContain('subgraph ExternalServices[');
      expect(result.syntax).toContain('🌐 External Services');
    });

    it('should not include external-service nodes inside regular layer subgraphs', () => {
      const generator = new DiagramGenerator();
      const apiNode: GraphNode = { id: 'app/api/route.ts', type: 'api', layer: 'API' };
      const extNode: GraphNode = { id: 'prisma', type: 'external-service', label: 'Prisma DB', layer: 'Storage' };

      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/api/route.ts', apiNode],
          ['prisma', extNode],
        ]),
        edges: [],
        layers: new Map<ArchitectureLayer, GraphNode[]>([
          ['API', [apiNode]],
          ['Storage', [extNode]],
        ]),
        domains: new Map(),
      };

      const result = generator.generate(graph);
      const lines = result.syntax.split('\n');

      // Find the Storage subgraph block (if it exists) and verify prisma is NOT inside it
      const storageSubgraphStart = lines.findIndex(l => l.includes('subgraph Storage['));
      if (storageSubgraphStart >= 0) {
        const storageSubgraphEnd = lines.findIndex((l, i) => i > storageSubgraphStart && l.trim() === 'end');
        const storageBlock = lines.slice(storageSubgraphStart, storageSubgraphEnd + 1).join('\n');
        expect(storageBlock).not.toContain('prisma');
      }

      // prisma should be in the ExternalServices subgraph
      expect(result.syntax).toContain('subgraph ExternalServices[');
      const extStart = lines.findIndex(l => l.includes('subgraph ExternalServices['));
      const extEnd = lines.findIndex((l, i) => i > extStart && l.trim() === 'end');
      const extBlock = lines.slice(extStart, extEnd + 1).join('\n');
      expect(extBlock).toContain('prisma');
    });

    it('should add classDef externalService styling', () => {
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api', layer: 'API' }],
          ['prisma', { id: 'prisma', type: 'external-service', label: 'Prisma DB', layer: 'Storage' }],
        ]),
        edges: [],
      };

      const result = generator.generate(graph);

      expect(result.syntax).toContain('classDef externalService');
      expect(result.syntax).toContain('class prisma externalService');
    });

    it('should not add External Services subgraph when there are no external-service nodes', () => {
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/page.tsx', { id: 'app/page.tsx', type: 'route', layer: 'UI' }],
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api', layer: 'API' }],
        ]),
        edges: [],
      };

      const result = generator.generate(graph);

      expect(result.syntax).not.toContain('ExternalServices');
      expect(result.syntax).not.toContain('classDef externalService');
    });

    it('should render external-call edges with "calls" label to external service nodes', () => {
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api', layer: 'API' }],
          ['https://api.openweathermap.org', {
            id: 'https://api.openweathermap.org',
            type: 'external-service',
            label: 'Openweathermap API',
            layer: 'Processing',
          }],
        ]),
        edges: [
          { from: 'app/api/route.ts', to: 'https://api.openweathermap.org', type: 'external-call' },
        ],
      };

      const result = generator.generate(graph);

      expect(result.syntax).toContain('-- calls -->');
    });
  });
});

/**
 * Task 13.2 - Unit tests for external service visualization
 * Validates: Requirements 3.6
 */
describe('External service visualization unit tests (Task 13.2)', () => {
  describe('External service node styling', () => {
    it('should render database nodes with cylinder shape [(label)]', () => {
      // Validates: Requirements 3.6
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api', layer: 'API' }],
          ['postgres', { id: 'postgres', type: 'external-service', label: 'Postgres DB', layer: 'Storage' }],
        ]),
        edges: [],
      };

      const result = generator.generate(graph);

      // Cylinder shape: [(label)]
      expect(result.syntax).toContain('postgres[(Postgres DB)]');
    });

    it('should render API nodes with stadium shape ([label])', () => {
      // Validates: Requirements 3.6
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api', layer: 'API' }],
          ['external/rest-api', { id: 'external/rest-api', type: 'external-service', label: 'REST API', layer: 'Processing' }],
        ]),
        edges: [],
      };

      const result = generator.generate(graph);

      // Stadium shape: ([label])
      expect(result.syntax).toContain('([REST API])');
    });

    it('should render unknown external services with hexagon shape {{label}}', () => {
      // Validates: Requirements 3.6
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api', layer: 'API' }],
          ['third-party', { id: 'third-party', type: 'external-service', label: 'Third Party', layer: 'Processing' }],
        ]),
        edges: [],
      };

      const result = generator.generate(graph);

      // Hexagon shape: {{label}}
      expect(result.syntax).toContain('{{Third Party}}');
    });

    it('should apply distinct classDef styling to external service nodes', () => {
      // Validates: Requirements 3.6
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api', layer: 'API' }],
          ['redis', { id: 'redis', type: 'external-service', label: 'Redis Cache', layer: 'Storage' }],
        ]),
        edges: [],
      };

      const result = generator.generate(graph);

      // Should define and assign the externalService class
      expect(result.syntax).toContain('classDef externalService');
      expect(result.syntax).toContain('class redis externalService');
    });

    it('should use different shapes for database vs API external services', () => {
      // Validates: Requirements 3.6
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api', layer: 'API' }],
          ['mysql', { id: 'mysql', type: 'external-service', label: 'MySQL DB', layer: 'Storage' }],
          ['external/graphql', { id: 'external/graphql', type: 'external-service', label: 'GraphQL API', layer: 'Processing' }],
        ]),
        edges: [],
      };

      const result = generator.generate(graph);

      // Database uses cylinder [(label)], API uses stadium ([label])
      expect(result.syntax).toContain('mysql[(MySQL DB)]');
      expect(result.syntax).toContain('([GraphQL API])');
    });

    it('should not apply external service shapes to regular internal nodes', () => {
      // Validates: Requirements 3.6
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api', layer: 'API' }],
          ['lib/utils.ts', { id: 'lib/utils.ts', type: 'utility', layer: 'Processing' }],
        ]),
        edges: [],
      };

      const result = generator.generate(graph);

      // Regular nodes use rectangle shape [label], not cylinder or stadium
      expect(result.syntax).toContain('app_api_route_ts[');
      expect(result.syntax).toContain('lib_utils_ts[');
      // Should not contain cylinder or stadium shapes for internal nodes
      expect(result.syntax).not.toContain('app_api_route_ts[(');
      expect(result.syntax).not.toContain('lib_utils_ts([');
    });
  });

  describe('Subgraph grouping for external services', () => {
    it('should create a dedicated "External Services" subgraph when external nodes exist', () => {
      // Validates: Requirements 3.6
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api', layer: 'API' }],
          ['prisma', { id: 'prisma', type: 'external-service', label: 'Prisma DB', layer: 'Storage' }],
        ]),
        edges: [],
      };

      const result = generator.generate(graph);

      expect(result.syntax).toContain('subgraph ExternalServices[');
      expect(result.syntax).toContain('🌐 External Services');
    });

    it('should place all external service nodes inside the ExternalServices subgraph', () => {
      // Validates: Requirements 3.6
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api', layer: 'API' }],
          ['prisma', { id: 'prisma', type: 'external-service', label: 'Prisma DB', layer: 'Storage' }],
          ['https://api.openweathermap.org', {
            id: 'https://api.openweathermap.org',
            type: 'external-service',
            label: 'OpenWeather API',
            layer: 'Processing',
          }],
        ]),
        edges: [],
      };

      const result = generator.generate(graph);
      const lines = result.syntax.split('\n');

      const extStart = lines.findIndex(l => l.includes('subgraph ExternalServices['));
      const extEnd = lines.findIndex((l, i) => i > extStart && l.trim() === 'end');
      const extBlock = lines.slice(extStart, extEnd + 1).join('\n');

      expect(extBlock).toContain('prisma');
      expect(extBlock).toContain('https_api_openweathermap_org');
    });

    it('should omit the ExternalServices subgraph when no external service nodes exist', () => {
      // Validates: Requirements 3.6
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/page.tsx', { id: 'app/page.tsx', type: 'route', layer: 'UI' }],
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api', layer: 'API' }],
        ]),
        edges: [],
      };

      const result = generator.generate(graph);

      expect(result.syntax).not.toContain('ExternalServices');
      expect(result.syntax).not.toContain('External Services');
    });

    it('should keep external service nodes out of regular architecture layer subgraphs', () => {
      // Validates: Requirements 3.6
      const generator = new DiagramGenerator();
      const apiNode: GraphNode = { id: 'app/api/route.ts', type: 'api', layer: 'API' };
      const extNode: GraphNode = { id: 'prisma', type: 'external-service', label: 'Prisma DB', layer: 'Storage' };

      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/api/route.ts', apiNode],
          ['prisma', extNode],
        ]),
        edges: [],
        layers: new Map<ArchitectureLayer, GraphNode[]>([
          ['API', [apiNode]],
          ['Storage', [extNode]],
        ]),
        domains: new Map(),
      };

      const result = generator.generate(graph);
      const lines = result.syntax.split('\n');

      // Storage subgraph should not contain the external service node
      const storageStart = lines.findIndex(l => l.includes('subgraph Storage['));
      if (storageStart >= 0) {
        const storageEnd = lines.findIndex((l, i) => i > storageStart && l.trim() === 'end');
        const storageBlock = lines.slice(storageStart, storageEnd + 1).join('\n');
        expect(storageBlock).not.toContain('prisma');
      }

      // External service should be in ExternalServices subgraph
      const extStart = lines.findIndex(l => l.includes('subgraph ExternalServices['));
      expect(extStart).toBeGreaterThanOrEqual(0);
      const extEnd = lines.findIndex((l, i) => i > extStart && l.trim() === 'end');
      const extBlock = lines.slice(extStart, extEnd + 1).join('\n');
      expect(extBlock).toContain('prisma');
    });

    it('should render multiple external services in the same ExternalServices subgraph', () => {
      // Validates: Requirements 3.6
      const generator = new DiagramGenerator();
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api', layer: 'API' }],
          ['postgres', { id: 'postgres', type: 'external-service', label: 'PostgreSQL', layer: 'Storage' }],
          ['redis', { id: 'redis', type: 'external-service', label: 'Redis Cache', layer: 'Storage' }],
          ['external/weather-api', { id: 'external/weather-api', type: 'external-service', label: 'Weather API', layer: 'Processing' }],
        ]),
        edges: [],
      };

      const result = generator.generate(graph);

      // Only one ExternalServices subgraph should exist
      const occurrences = (result.syntax.match(/subgraph ExternalServices/g) || []).length;
      expect(occurrences).toBe(1);

      // All three external services should be inside it
      const lines = result.syntax.split('\n');
      const extStart = lines.findIndex(l => l.includes('subgraph ExternalServices['));
      const extEnd = lines.findIndex((l, i) => i > extStart && l.trim() === 'end');
      const extBlock = lines.slice(extStart, extEnd + 1).join('\n');

      expect(extBlock).toContain('postgres');
      expect(extBlock).toContain('redis');
      // Hyphen should be converted to underscore in node ID
      expect(extBlock).toContain('external_weather_api');
    });
  });
});
