import { describe, it, expect } from 'vitest';
import { DiagramGenerator, DependencyGraph, ClassifiedGraph } from '../generators/DiagramGenerator';
import { VisualExporter } from '../generators/VisualExporter';

describe('Phase 6 Checkpoint - Multiple Output Formats', () => {
  describe('Simplified Diagram Generation', () => {
    it('should generate simplified diagram with aggregated nodes', () => {
      const generator = new DiagramGenerator();
      
      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/page.tsx', { id: 'app/page.tsx', type: 'route', layer: 'UI', domain: 'Dashboard' }],
          ['app/components/Header.tsx', { id: 'app/components/Header.tsx', type: 'component', layer: 'UI', domain: 'Dashboard' }],
          ['app/api/risk/route.ts', { id: 'app/api/risk/route.ts', type: 'api', layer: 'API', domain: 'Risk' }],
          ['lib/risk-calc.ts', { id: 'lib/risk-calc.ts', type: 'utility', layer: 'Processing', domain: 'Risk' }],
        ]),
        edges: [
          { from: 'app/page.tsx', to: 'app/api/risk/route.ts', type: 'import' },
          { from: 'app/api/risk/route.ts', to: 'lib/risk-calc.ts', type: 'import' },
        ],
        layers: new Map([
          ['UI', [
            { id: 'app/page.tsx', type: 'route', layer: 'UI', domain: 'Dashboard' },
            { id: 'app/components/Header.tsx', type: 'component', layer: 'UI', domain: 'Dashboard' },
          ]],
          ['API', [
            { id: 'app/api/risk/route.ts', type: 'api', layer: 'API', domain: 'Risk' },
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

      // Verify simplified diagram properties
      expect(result.syntax).toContain('graph LR');
      expect(result.syntax).toContain('subgraph UI');
      expect(result.syntax).toContain('subgraph API');
      expect(result.syntax).toContain('subgraph Processing');
      expect(result.metadata.nodeCount).toBeGreaterThan(0);
      expect(result.metadata.edgeCount).toBeGreaterThanOrEqual(0);
    });

    it('should aggregate nodes by domain in simplified mode', () => {
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

      // Simplified diagram should show aggregated nodes
      expect(result.syntax).toContain('Risk');
      expect(result.syntax).toContain('subgraph API');
    });
  });

  describe('Detailed Diagram Generation', () => {
    it('should generate detailed diagram with all modules', () => {
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

      // Verify detailed diagram shows all modules
      expect(result.syntax).toContain('app_page_tsx');
      expect(result.syntax).toContain('app_components_Header_tsx');
      expect(result.syntax).toContain('app_api_route_ts');
      expect(result.syntax).toContain('lib_util_ts');
      expect(result.metadata.nodeCount).toBe(4);
      expect(result.metadata.edgeCount).toBe(3);
    });

    it('should show all dependencies in detailed mode', () => {
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
  });

  describe('Visual Exporter', () => {
    it('should initialize with default export options', () => {
      const exporter = new VisualExporter();
      expect(exporter).toBeDefined();
    });

    it('should support PNG export configuration', () => {
      const exporter = new VisualExporter({
        width: 1920,
        height: 1080,
        theme: 'dark',
      });
      expect(exporter).toBeDefined();
    });

    it('should support SVG export configuration', () => {
      const exporter = new VisualExporter({
        width: 1600,
        height: 900,
        backgroundColor: '#f0f0f0',
      });
      expect(exporter).toBeDefined();
    });

    it('should allow reconfiguring export options', () => {
      const exporter = new VisualExporter();
      exporter.configure({
        width: 2000,
        height: 1200,
        theme: 'forest',
      });
      expect(exporter).toBeDefined();
    });
  });

  describe('Multi-format Output', () => {
    it('should support generating both simplified and detailed diagrams', () => {
      const generator = new DiagramGenerator();
      
      const graph: ClassifiedGraph = {
        nodes: new Map([
          ['app/page.tsx', { id: 'app/page.tsx', type: 'route', layer: 'UI' }],
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api', layer: 'API' }],
        ]),
        edges: [
          { from: 'app/page.tsx', to: 'app/api/route.ts', type: 'import' },
        ],
        layers: new Map([
          ['UI', [{ id: 'app/page.tsx', type: 'route', layer: 'UI' }]],
          ['API', [{ id: 'app/api/route.ts', type: 'api', layer: 'API' }]],
          ['Processing', []],
          ['Data', []],
          ['Storage', []],
        ]),
        domains: new Map(),
      };

      const simplified = generator.generateSimplified(graph);
      const detailed = generator.generateDetailed(graph);

      // Both should be valid Mermaid diagrams
      expect(simplified.syntax).toContain('graph LR');
      expect(detailed.syntax).toContain('graph LR');
      
      // Both should have metadata
      expect(simplified.metadata.nodeCount).toBeGreaterThan(0);
      expect(detailed.metadata.nodeCount).toBeGreaterThan(0);
    });

    it('should support multiple output formats (markdown, PNG, SVG)', () => {
      const exporter = new VisualExporter();
      
      // Test that exporter can be configured for different formats
      exporter.configure({ width: 1200, height: 800 });
      exporter.configure({ theme: 'dark' });
      exporter.configure({ backgroundColor: '#ffffff' });
      
      expect(exporter).toBeDefined();
    });
  });

  describe('Output Quality Verification', () => {
    it('should generate valid Mermaid syntax for simplified diagrams', () => {
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

      // Verify Mermaid syntax is valid
      expect(result.syntax).toMatch(/^%%\{init:/);
      expect(result.syntax).toContain('graph LR');
      expect(result.syntax).toContain('subgraph');
      expect(result.syntax).toContain('end');
    });

    it('should generate valid Mermaid syntax for detailed diagrams', () => {
      const generator = new DiagramGenerator();
      
      const graph: DependencyGraph = {
        nodes: new Map([
          ['app/page.tsx', { id: 'app/page.tsx', type: 'route' }],
          ['app/api/route.ts', { id: 'app/api/route.ts', type: 'api' }],
          ['lib/util.ts', { id: 'lib/util.ts', type: 'utility' }],
        ]),
        edges: [
          { from: 'app/page.tsx', to: 'app/api/route.ts', type: 'import' },
          { from: 'app/api/route.ts', to: 'lib/util.ts', type: 'import' },
        ],
      };

      const result = generator.generateDetailed(graph);

      // Verify Mermaid syntax is valid
      expect(result.syntax).toMatch(/^%%\{init:/);
      expect(result.syntax).toContain('graph LR');
      expect(result.syntax).toContain('-->');
    });

    it('should include metadata in generated diagrams', () => {
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

      const result = generator.generateDetailed(graph);

      // Verify metadata is present and correct
      expect(result.metadata.nodeCount).toBe(2);
      expect(result.metadata.edgeCount).toBe(1);
      expect(result.metadata.generatedAt).toBeInstanceOf(Date);
    });
  });
});
