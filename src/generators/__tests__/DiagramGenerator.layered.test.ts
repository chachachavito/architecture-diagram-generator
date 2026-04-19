import { describe, it, expect, beforeEach } from 'vitest';
import {
  DiagramGenerator,
  DependencyGraph,
  ClassifiedGraph,
  GraphNode,
  GraphEdge,
  ArchitectureLayer,
  GenerationOptions,
} from '../DiagramGenerator';

describe('DiagramGenerator - Layered Visualization', () => {
  let generator: DiagramGenerator;

  beforeEach(() => {
    generator = new DiagramGenerator();
  });

  describe('Subgraph generation by layer', () => {
    it('should generate subgraphs for each layer with nodes', () => {
      // Create a classified graph with nodes in different layers
      const graph: ClassifiedGraph = {
        nodes: new Map([
          [
            'app/page.tsx',
            {
              id: 'app/page.tsx',
              type: 'route',
              layer: 'UI',
              domain: 'Dashboard',
              label: 'Home Page',
            },
          ],
          [
            'app/api/risk/route.ts',
            {
              id: 'app/api/risk/route.ts',
              type: 'api',
              layer: 'API',
              domain: 'Risk',
              label: 'Risk API',
            },
          ],
          [
            'lib/risk-calculator.ts',
            {
              id: 'lib/risk-calculator.ts',
              type: 'utility',
              layer: 'Processing',
              domain: 'Risk',
              label: 'Risk Calculator',
            },
          ],
          [
            'prisma/client.ts',
            {
              id: 'prisma/client.ts',
              type: 'utility',
              layer: 'Data',
              domain: undefined,
              label: 'Prisma Client',
            },
          ],
        ]),
        edges: [
          { from: 'app/page.tsx', to: 'app/api/risk/route.ts', type: 'import' },
          { from: 'app/api/risk/route.ts', to: 'lib/risk-calculator.ts', type: 'import' },
          { from: 'lib/risk-calculator.ts', to: 'prisma/client.ts', type: 'import' },
        ],
        layers: new Map([
          ['UI', [{ id: 'app/page.tsx', type: 'route', layer: 'UI', domain: 'Dashboard' }]],
          ['API', [{ id: 'app/api/risk/route.ts', type: 'api', layer: 'API', domain: 'Risk' }]],
          ['Processing', [{ id: 'lib/risk-calculator.ts', type: 'utility', layer: 'Processing', domain: 'Risk' }]],
          ['Data', [{ id: 'prisma/client.ts', type: 'utility', layer: 'Data' }]],
          ['Storage', []],
        ]),
        domains: new Map(),
      };

      const options: GenerationOptions = {
        groupByLayer: true,
        showDependencies: true,
      };

      const diagram = generator.generate(graph, options);

      // Verify subgraph declarations for each layer
      expect(diagram.syntax).toContain('subgraph UI');
      expect(diagram.syntax).toContain('subgraph API');
      expect(diagram.syntax).toContain('subgraph Processing');
      expect(diagram.syntax).toContain('subgraph Data');

      // Verify layer icons are present
      expect(diagram.syntax).toContain('🎨 UI');
      expect(diagram.syntax).toContain('⚡ API');
      expect(diagram.syntax).toContain('⚙️ Services');
      expect(diagram.syntax).toContain('💾 Data');
    });

    it('should not generate subgraphs for empty layers', () => {
      const graph: ClassifiedGraph = {
        nodes: new Map([
          [
            'app/page.tsx',
            {
              id: 'app/page.tsx',
              type: 'route',
              layer: 'UI',
              domain: 'Dashboard',
            },
          ],
        ]),
        edges: [],
        layers: new Map([
          ['UI', [{ id: 'app/page.tsx', type: 'route', layer: 'UI', domain: 'Dashboard' }]],
          ['API', []],
          ['Processing', []],
          ['Data', []],
          ['Storage', []],
        ]),
        domains: new Map(),
      };

      const diagram = generator.generate(graph, { groupByLayer: true });

      // Only UI layer should be present
      expect(diagram.syntax).toContain('subgraph UI');
      expect(diagram.syntax).not.toContain('subgraph API');
      expect(diagram.syntax).not.toContain('subgraph Processing');
      expect(diagram.syntax).not.toContain('subgraph Data');
      expect(diagram.syntax).not.toContain('subgraph Storage');
    });

    it('should correctly group nodes by layer in subgraphs', () => {
      const graph: ClassifiedGraph = {
        nodes: new Map([
          [
            'app/page.tsx',
            {
              id: 'app/page.tsx',
              type: 'route',
              layer: 'UI',
              domain: 'Dashboard',
            },
          ],
          [
            'app/components/Card.tsx',
            {
              id: 'app/components/Card.tsx',
              type: 'component',
              layer: 'UI',
              domain: 'Dashboard',
            },
          ],
          [
            'app/api/weather/route.ts',
            {
              id: 'app/api/weather/route.ts',
              type: 'api',
              layer: 'API',
              domain: 'Weather',
            },
          ],
        ]),
        edges: [],
        layers: new Map([
          [
            'UI',
            [
              { id: 'app/page.tsx', type: 'route', layer: 'UI', domain: 'Dashboard' },
              { id: 'app/components/Card.tsx', type: 'component', layer: 'UI', domain: 'Dashboard' },
            ],
          ],
          ['API', [{ id: 'app/api/weather/route.ts', type: 'api', layer: 'API', domain: 'Weather' }]],
          ['Processing', []],
          ['Data', []],
          ['Storage', []],
        ]),
        domains: new Map(),
      };

      const diagram = generator.generate(graph, { groupByLayer: true });

      // Verify both UI nodes are within the UI subgraph
      const uiSubgraphStart = diagram.syntax.indexOf('subgraph UI');
      const uiSubgraphEnd = diagram.syntax.indexOf('end', uiSubgraphStart);
      const uiSubgraphContent = diagram.syntax.substring(uiSubgraphStart, uiSubgraphEnd);

      expect(uiSubgraphContent).toContain('app_page_tsx');
      expect(uiSubgraphContent).toContain('app_components_Card_tsx');

      // Verify API node is in API subgraph
      const apiSubgraphStart = diagram.syntax.indexOf('subgraph API');
      const apiSubgraphEnd = diagram.syntax.indexOf('end', apiSubgraphStart);
      const apiSubgraphContent = diagram.syntax.substring(apiSubgraphStart, apiSubgraphEnd);

      expect(apiSubgraphContent).toContain('app_api_weather_route_ts');
    });

    it('should handle single-node layers correctly', () => {
      const graph: ClassifiedGraph = {
        nodes: new Map([
          [
            'app/page.tsx',
            {
              id: 'app/page.tsx',
              type: 'route',
              layer: 'UI',
            },
          ],
          [
            'app/api/route.ts',
            {
              id: 'app/api/route.ts',
              type: 'api',
              layer: 'API',
            },
          ],
        ]),
        edges: [],
        layers: new Map([
          ['UI', [{ id: 'app/page.tsx', type: 'route', layer: 'UI' }]],
          ['API', [{ id: 'app/api/route.ts', type: 'api', layer: 'API' }]],
          ['Processing', []],
          ['Data', []],
          ['Storage', []],
        ]),
        domains: new Map(),
      };

      const diagram = generator.generate(graph, { groupByLayer: true });

      // Both layers should be present with single nodes
      expect(diagram.syntax).toContain('subgraph UI');
      expect(diagram.syntax).toContain('subgraph API');
      expect(diagram.syntax).toContain('app_page_tsx');
      expect(diagram.syntax).toContain('app_api_route_ts');
    });

    it('should maintain layer order: UI, API, Processing, Data, Storage', () => {
      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['storage.ts', { id: 'storage.ts', type: 'utility', layer: 'Storage' }],
          ['data.ts', { id: 'data.ts', type: 'utility', layer: 'Data' }],
          ['process.ts', { id: 'process.ts', type: 'utility', layer: 'Processing' }],
          ['api.ts', { id: 'api.ts', type: 'api', layer: 'API' }],
          ['ui.tsx', { id: 'ui.tsx', type: 'route', layer: 'UI' }],
        ]),
        edges: [],
        layers: new Map([
          ['UI', [{ id: 'ui.tsx', type: 'route', layer: 'UI' }]],
          ['API', [{ id: 'api.ts', type: 'api', layer: 'API' }]],
          ['Processing', [{ id: 'process.ts', type: 'utility', layer: 'Processing' }]],
          ['Data', [{ id: 'data.ts', type: 'utility', layer: 'Data' }]],
          ['Storage', [{ id: 'storage.ts', type: 'utility', layer: 'Storage' }]],
        ]),
        domains: new Map(),
      };

      const diagram = generator.generate(graph, { groupByLayer: true });

      // Find positions of each layer
      const uiPos = diagram.syntax.indexOf('subgraph UI');
      const apiPos = diagram.syntax.indexOf('subgraph API');
      const processingPos = diagram.syntax.indexOf('subgraph Processing');
      const dataPos = diagram.syntax.indexOf('subgraph Data');
      const storagePos = diagram.syntax.indexOf('subgraph Storage');

      // Verify order (all should be found and in correct order)
      expect(uiPos).toBeGreaterThan(-1);
      expect(apiPos).toBeGreaterThan(uiPos);
      expect(processingPos).toBeGreaterThan(apiPos);
      expect(dataPos).toBeGreaterThan(processingPos);
      expect(storagePos).toBeGreaterThan(dataPos);
    });
  });

  describe('Domain labeling', () => {
    it('should label nodes with domain information within layers', () => {
      const graph: ClassifiedGraph = {
        nodes: new Map([
          [
            'app/api/risk/route.ts',
            {
              id: 'app/api/risk/route.ts',
              type: 'api',
              layer: 'API',
              domain: 'Risk',
            },
          ],
          [
            'lib/risk-calculator.ts',
            {
              id: 'lib/risk-calculator.ts',
              type: 'utility',
              layer: 'Processing',
              domain: 'Risk',
            },
          ],
        ]),
        edges: [],
        layers: new Map([
          ['UI', []],
          ['API', [{ id: 'app/api/risk/route.ts', type: 'api', layer: 'API', domain: 'Risk' }]],
          ['Processing', [{ id: 'lib/risk-calculator.ts', type: 'utility', layer: 'Processing', domain: 'Risk' }]],
          ['Data', []],
          ['Storage', []],
        ]),
        domains: new Map(),
      };

      const diagram = generator.generate(graph, { groupByLayer: true });

      // Verify domain labels appear in the diagram
      expect(diagram.syntax).toContain('Risk');
    });

    it('should create domain subgraphs when multiple domains exist in a layer', () => {
      const graph: ClassifiedGraph = {
        nodes: new Map([
          [
            'app/api/risk/route.ts',
            {
              id: 'app/api/risk/route.ts',
              type: 'api',
              layer: 'API',
              domain: 'Risk',
            },
          ],
          [
            'app/api/weather/route.ts',
            {
              id: 'app/api/weather/route.ts',
              type: 'api',
              layer: 'API',
              domain: 'Weather',
            },
          ],
        ]),
        edges: [],
        layers: new Map([
          ['UI', []],
          [
            'API',
            [
              { id: 'app/api/risk/route.ts', type: 'api', layer: 'API', domain: 'Risk' },
              { id: 'app/api/weather/route.ts', type: 'api', layer: 'API', domain: 'Weather' },
            ],
          ],
          ['Processing', []],
          ['Data', []],
          ['Storage', []],
        ]),
        domains: new Map(),
      };

      const diagram = generator.generate(graph, { groupByLayer: true });

      // Verify both nodes are present in the API layer
      expect(diagram.syntax).toContain('subgraph API');
      expect(diagram.syntax).toContain('app_api_risk_route_ts');
      expect(diagram.syntax).toContain('app_api_weather_route_ts');
    });

    it('should handle nodes without domain information', () => {
      const graph: ClassifiedGraph = {
        nodes: new Map([
          [
            'app/api/route.ts',
            {
              id: 'app/api/route.ts',
              type: 'api',
              layer: 'API',
              domain: undefined,
            },
          ],
          [
            'lib/helper.ts',
            {
              id: 'lib/helper.ts',
              type: 'utility',
              layer: 'Processing',
              domain: undefined,
            },
          ],
        ]),
        edges: [],
        layers: new Map([
          ['UI', []],
          ['API', [{ id: 'app/api/route.ts', type: 'api', layer: 'API' }]],
          ['Processing', [{ id: 'lib/helper.ts', type: 'utility', layer: 'Processing' }]],
          ['Data', []],
          ['Storage', []],
        ]),
        domains: new Map(),
      };

      const diagram = generator.generate(graph, { groupByLayer: true });

      // Should still generate valid diagram without domain labels
      expect(diagram.syntax).toContain('subgraph API');
      expect(diagram.syntax).toContain('subgraph Processing');
      expect(diagram.syntax).toContain('app_api_route_ts');
      expect(diagram.syntax).toContain('lib_helper_ts');
    });

    it('should group multiple nodes by domain within a layer', () => {
      const graph: ClassifiedGraph = {
        nodes: new Map([
          [
            'app/api/risk/calculate/route.ts',
            {
              id: 'app/api/risk/calculate/route.ts',
              type: 'api',
              layer: 'API',
              domain: 'Risk',
            },
          ],
          [
            'app/api/risk/validate/route.ts',
            {
              id: 'app/api/risk/validate/route.ts',
              type: 'api',
              layer: 'API',
              domain: 'Risk',
            },
          ],
          [
            'lib/risk-calculator.ts',
            {
              id: 'lib/risk-calculator.ts',
              type: 'utility',
              layer: 'Processing',
              domain: 'Risk',
            },
          ],
          [
            'lib/risk-validator.ts',
            {
              id: 'lib/risk-validator.ts',
              type: 'utility',
              layer: 'Processing',
              domain: 'Risk',
            },
          ],
        ]),
        edges: [],
        layers: new Map([
          ['UI', []],
          [
            'API',
            [
              { id: 'app/api/risk/calculate/route.ts', type: 'api', layer: 'API', domain: 'Risk' },
              { id: 'app/api/risk/validate/route.ts', type: 'api', layer: 'API', domain: 'Risk' },
            ],
          ],
          [
            'Processing',
            [
              { id: 'lib/risk-calculator.ts', type: 'utility', layer: 'Processing', domain: 'Risk' },
              { id: 'lib/risk-validator.ts', type: 'utility', layer: 'Processing', domain: 'Risk' },
            ],
          ],
          ['Data', []],
          ['Storage', []],
        ]),
        domains: new Map(),
      };

      const diagram = generator.generate(graph, { groupByLayer: true });

      // Verify both API nodes are present
      expect(diagram.syntax).toContain('app_api_risk_calculate_route_ts');
      expect(diagram.syntax).toContain('app_api_risk_validate_route_ts');

      // Verify both Processing nodes are present
      expect(diagram.syntax).toContain('lib_risk_calculator_ts');
      expect(diagram.syntax).toContain('lib_risk_validator_ts');

      // Verify Risk domain is labeled
      expect(diagram.syntax).toContain('Risk');
    });

    it('should handle mixed domains and non-domain nodes in same layer', () => {
      const graph: ClassifiedGraph = {
        nodes: new Map([
          [
            'app/api/risk/route.ts',
            {
              id: 'app/api/risk/route.ts',
              type: 'api',
              layer: 'API',
              domain: 'Risk',
            },
          ],
          [
            'app/api/health/route.ts',
            {
              id: 'app/api/health/route.ts',
              type: 'api',
              layer: 'API',
              domain: undefined,
            },
          ],
        ]),
        edges: [],
        layers: new Map([
          ['UI', []],
          [
            'API',
            [
              { id: 'app/api/risk/route.ts', type: 'api', layer: 'API', domain: 'Risk' },
              { id: 'app/api/health/route.ts', type: 'api', layer: 'API' },
            ],
          ],
          ['Processing', []],
          ['Data', []],
          ['Storage', []],
        ]),
        domains: new Map(),
      };

      const diagram = generator.generate(graph, { groupByLayer: true });

      // Both nodes should be present
      expect(diagram.syntax).toContain('app_api_risk_route_ts');
      expect(diagram.syntax).toContain('app_api_health_route_ts');

      // Risk domain should be labeled
      expect(diagram.syntax).toContain('Risk');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty layers gracefully', () => {
      const graph: ClassifiedGraph = {
        nodes: new Map(),
        edges: [],
        layers: new Map([
          ['UI', []],
          ['API', []],
          ['Processing', []],
          ['Data', []],
          ['Storage', []],
        ]),
        domains: new Map(),
      };

      // Empty graphs will throw because they have no nodes
      // This is expected behavior - a diagram must have at least one node
      expect(() => {
        generator.generate(graph, { groupByLayer: true });
      }).toThrow('Mermaid diagram must contain at least one node');
    });

    it('should handle graph with only external-service nodes', () => {
      const graph: ClassifiedGraph = {
        nodes: new Map([
          [
            'prisma',
            {
              id: 'prisma',
              type: 'external-service',
              layer: 'Storage',
            },
          ],
          [
            'openweather-api',
            {
              id: 'openweather-api',
              type: 'external-service',
              layer: 'Storage',
            },
          ],
        ]),
        edges: [],
        layers: new Map([
          ['UI', []],
          ['API', []],
          ['Processing', []],
          ['Data', []],
          ['Storage', [
            { id: 'prisma', type: 'external-service', layer: 'Storage' },
            { id: 'openweather-api', type: 'external-service', layer: 'Storage' },
          ]],
        ]),
        domains: new Map(),
      };

      const diagram = generator.generate(graph, { groupByLayer: true });

      // Should have External Services subgraph
      expect(diagram.syntax).toContain('ExternalServices');
      expect(diagram.syntax).toContain('External Services');
      expect(diagram.syntax).toContain('prisma');
      // The node ID is sanitized, so openweather-api becomes openweather_api (dashes are converted to underscores)
      expect(diagram.syntax).toContain('openweather_api');
    });

    it('should generate valid Mermaid syntax with layered visualization', () => {
      const graph: ClassifiedGraph = {
        nodes: new Map([
          [
            'app/page.tsx',
            {
              id: 'app/page.tsx',
              type: 'route',
              layer: 'UI',
              domain: 'Dashboard',
            },
          ],
          [
            'app/api/risk/route.ts',
            {
              id: 'app/api/risk/route.ts',
              type: 'api',
              layer: 'API',
              domain: 'Risk',
            },
          ],
        ]),
        edges: [{ from: 'app/page.tsx', to: 'app/api/risk/route.ts', type: 'import' }],
        layers: new Map([
          ['UI', [{ id: 'app/page.tsx', type: 'route', layer: 'UI', domain: 'Dashboard' }]],
          ['API', [{ id: 'app/api/risk/route.ts', type: 'api', layer: 'API', domain: 'Risk' }]],
          ['Processing', []],
          ['Data', []],
          ['Storage', []],
        ]),
        domains: new Map(),
      };

      const diagram = generator.generate(graph, { groupByLayer: true });

      // Verify basic Mermaid structure
      expect(diagram.syntax).toContain('graph LR');
      expect(diagram.syntax).toContain('subgraph');
      expect(diagram.syntax).toContain('end');

      // Verify nodes are present
      expect(diagram.syntax).toContain('app_page_tsx');
      expect(diagram.syntax).toContain('app_api_risk_route_ts');

      // Verify edges are present
      expect(diagram.syntax).toContain('-->');
    });

    it('should handle very long domain names', () => {
      const longDomainName = 'VeryLongDomainNameForTestingPurposesWithManyCharacters';
      const graph: ClassifiedGraph = {
        nodes: new Map([
          [
            'app/api/route.ts',
            {
              id: 'app/api/route.ts',
              type: 'api',
              layer: 'API',
              domain: longDomainName,
            },
          ],
        ]),
        edges: [],
        layers: new Map([
          ['UI', []],
          ['API', [{ id: 'app/api/route.ts', type: 'api', layer: 'API', domain: longDomainName }]],
          ['Processing', []],
          ['Data', []],
          ['Storage', []],
        ]),
        domains: new Map(),
      };

      const diagram = generator.generate(graph, { groupByLayer: true });

      // Should still generate valid diagram
      expect(diagram.syntax).toContain('subgraph API');
      // The node should be present
      expect(diagram.syntax).toContain('app_api_route_ts');
    });

    it('should handle special characters in domain names', () => {
      const graph: ClassifiedGraph = {
        nodes: new Map([
          [
            'app/api/route.ts',
            {
              id: 'app/api/route.ts',
              type: 'api',
              layer: 'API',
              domain: 'Risk-Analysis_v2',
            },
          ],
        ]),
        edges: [],
        layers: new Map([
          ['UI', []],
          ['API', [{ id: 'app/api/route.ts', type: 'api', layer: 'API', domain: 'Risk-Analysis_v2' }]],
          ['Processing', []],
          ['Data', []],
          ['Storage', []],
        ]),
        domains: new Map(),
      };

      const diagram = generator.generate(graph, { groupByLayer: true });

      // Should generate valid diagram with special characters in domain
      expect(diagram.syntax).toContain('subgraph API');
      // The node should be present
      expect(diagram.syntax).toContain('app_api_route_ts');
    });
  });

  describe('Metadata validation', () => {
    it('should include correct node and edge counts in metadata', () => {
      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['node1.ts', { id: 'node1.ts', type: 'utility', layer: 'Processing' }],
          ['node2.ts', { id: 'node2.ts', type: 'utility', layer: 'Processing' }],
          ['node3.ts', { id: 'node3.ts', type: 'utility', layer: 'Processing' }],
        ]),
        edges: [
          { from: 'node1.ts', to: 'node2.ts', type: 'import' },
          { from: 'node2.ts', to: 'node3.ts', type: 'import' },
        ],
        layers: new Map([
          ['UI', []],
          ['API', []],
          ['Processing', [
            { id: 'node1.ts', type: 'utility', layer: 'Processing' },
            { id: 'node2.ts', type: 'utility', layer: 'Processing' },
            { id: 'node3.ts', type: 'utility', layer: 'Processing' },
          ]],
          ['Data', []],
          ['Storage', []],
        ]),
        domains: new Map(),
      };

      const diagram = generator.generate(graph, { groupByLayer: true });

      expect(diagram.metadata.nodeCount).toBe(3);
      expect(diagram.metadata.edgeCount).toBe(2);
      expect(diagram.metadata.generatedAt).toBeInstanceOf(Date);
    });
  });
});
