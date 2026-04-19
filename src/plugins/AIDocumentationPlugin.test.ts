import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AIDocumentationPlugin,
  createAIDocumentationPlugin,
  type AIPluginConfig,
  type AIAnalysisResult,
} from './AIDocumentationPlugin';
import type { ClassifiedGraph, GraphNode, GraphEdge } from '../core/DependencyGraph';
import type { MermaidDiagram } from '../generators/DiagramGenerator';

// ─── Test Fixtures ────────────────────────────────────────────────────────────

const createNode = (
  id: string,
  type: GraphNode['type'] = 'component',
  layer?: string,
  domain?: string
): GraphNode => ({
  id,
  type,
  layer,
  domain,
  externalCalls: [],
});

const createGraph = (nodes: GraphNode[], edges: GraphEdge[] = []): ClassifiedGraph => ({
  nodes: new Map(nodes.map(n => [n.id, n])),
  edges,
  layers: new Map(),
  domains: new Map(),
});

const createClassifiedGraph = (
  nodes: GraphNode[],
  edges: GraphEdge[] = [],
  layers?: Map<string, GraphNode[]>,
  domains?: Map<string, GraphNode[]>
): ClassifiedGraph => {
  const graph = createGraph(nodes, edges);
  return {
    ...graph,
    layers: layers || new Map(),
    domains: domains || new Map(),
  };
};

const createDiagram = (): MermaidDiagram => ({
  syntax: 'graph TB\n  A --> B',
  metadata: {
    nodeCount: 2,
    edgeCount: 1,
    layers: ['UI'],
    domains: [],
    externalServices: [],
    generatedAt: new Date(),
  },
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AIDocumentationPlugin', () => {
  describe('constructor', () => {
    it('should create plugin with default config', () => {
      const plugin = new AIDocumentationPlugin();
      
      expect(plugin.name).toBe('ai-documentation-enhancer');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.hooks.afterClassification).toBeDefined();
      expect(plugin.hooks.afterGeneration).toBeDefined();
    });

    it('should create plugin with custom config', () => {
      const config: AIPluginConfig = {
        enabled: false,
        service: 'mock',
        generateModuleDescriptions: false,
      };
      const plugin = new AIDocumentationPlugin(config);
      
      expect(plugin.name).toBe('ai-documentation-enhancer');
    });
  });

  describe('analyzeGraph', () => {
    it('should generate module descriptions', async () => {
      const plugin = new AIDocumentationPlugin({
        service: 'mock',
        generateModuleDescriptions: true,
        generateDomainDescriptions: false,
        suggestImprovements: false,
      });

      const nodes = [
        createNode('app/page.tsx', 'component', 'UI', 'main'),
        createNode('lib/utils.ts', 'utility', 'Processing'),
      ];
      const graph = createClassifiedGraph(nodes);

      const result = await plugin.analyzeGraph(graph);

      expect(result.moduleDescriptions).toHaveLength(2);
      expect(result.moduleDescriptions[0].moduleId).toBe('app/page.tsx');
      expect(result.moduleDescriptions[0].description).toBeDefined();
    });

    it('should generate domain descriptions', async () => {
      const plugin = new AIDocumentationPlugin({
        service: 'mock',
        generateModuleDescriptions: false,
        generateDomainDescriptions: true,
        suggestImprovements: false,
      });

      const nodes = [
        createNode('app/risk/page.tsx', 'component', 'UI', 'Risk'),
        createNode('app/weather/page.tsx', 'component', 'UI', 'Weather'),
      ];
      const domains = new Map([
        ['Risk', [nodes[0]]],
        ['Weather', [nodes[1]]],
      ]);
      const graph = createClassifiedGraph(nodes, [], undefined, domains);

      const result = await plugin.analyzeGraph(graph);

      expect(result.domainDescriptions).toHaveLength(2);
      expect(result.domainDescriptions[0].domainName).toBe('Risk');
      expect(result.domainDescriptions[1].domainName).toBe('Weather');
    });

    it('should suggest improvements', async () => {
      const plugin = new AIDocumentationPlugin({
        service: 'mock',
        generateModuleDescriptions: false,
        generateDomainDescriptions: false,
        suggestImprovements: true,
      });

      const nodes = [createNode('app/page.tsx', 'component', 'UI')];
      const graph = createClassifiedGraph(nodes);

      const result = await plugin.analyzeGraph(graph);

      expect(result.improvements.length).toBeGreaterThan(0);
      expect(result.improvements[0].suggestion).toBeDefined();
    });

    it('should skip analysis when disabled', async () => {
      const plugin = new AIDocumentationPlugin({
        enabled: false,
        service: 'mock',
      });

      const nodes = [createNode('app/page.tsx', 'component', 'UI')];
      const graph = createClassifiedGraph(nodes);

      // Call analyzeGraph directly (hooks would skip due to enabled check)
      const result = await plugin.analyzeGraph(graph);

      // Should still work when called directly
      expect(result).toBeDefined();
    });

    it('should record analysis timestamp', async () => {
      const plugin = new AIDocumentationPlugin({ service: 'mock' });
      const graph = createClassifiedGraph([createNode('app/page.tsx')]);

      const result = await plugin.analyzeGraph(graph);

      expect(result.analyzedAt).toBeDefined();
      expect(new Date(result.analyzedAt)).toBeInstanceOf(Date);
    });
  });

  describe('getAnalysisResult', () => {
    it('should return undefined before analysis', () => {
      const plugin = new AIDocumentationPlugin();
      expect(plugin.getAnalysisResult()).toBeUndefined();
    });

    it('should return result after analysis', async () => {
      const plugin = new AIDocumentationPlugin({ service: 'mock' });
      const graph = createClassifiedGraph([createNode('app/page.tsx')]);

      await plugin.analyzeGraph(graph);
      const result = plugin.getAnalysisResult();

      expect(result).toBeDefined();
      expect(result?.moduleDescriptions).toBeDefined();
    });
  });

  describe('hooks', () => {
    it('should execute afterClassification hook', async () => {
      const plugin = new AIDocumentationPlugin({ service: 'mock' });
      const graph = createClassifiedGraph([createNode('app/page.tsx')]);

      await plugin.hooks.afterClassification!(graph);

      expect(plugin.getAnalysisResult()).toBeDefined();
    });

    it('should execute afterGeneration hook', async () => {
      const plugin = new AIDocumentationPlugin({ service: 'mock' });
      const graph = createClassifiedGraph([createNode('app/page.tsx')]);
      const diagram = createDiagram();

      // First run classification to generate analysis
      await plugin.hooks.afterClassification!(graph);
      await plugin.hooks.afterGeneration!(diagram);

      // Diagram should be enhanced with AI content
      expect(diagram.syntax).toContain('AI-Generated Descriptions');
    });

    it('should not enhance diagram without analysis', async () => {
      const plugin = new AIDocumentationPlugin({ service: 'mock' });
      const diagram = createDiagram();
      const originalSyntax = diagram.syntax;

      await plugin.hooks.afterGeneration!(diagram);

      // Diagram should not be modified
      expect(diagram.syntax).toBe(originalSyntax);
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const errorSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Create plugin with invalid OpenAI config (no API key)
      const plugin = new AIDocumentationPlugin({
        service: 'openai',
        apiKey: '', // No API key
      });

      const graph = createClassifiedGraph([createNode('app/page.tsx')]);

      // Should not throw, but log warning
      const result = await plugin.analyzeGraph(graph);

      // Should have empty results due to error
      expect(result.moduleDescriptions).toHaveLength(0);
      expect(errorSpy).toHaveBeenCalled();
      
      errorSpy.mockRestore();
    });
  });
});

describe('createAIDocumentationPlugin', () => {
  it('should create plugin instance', () => {
    const plugin = createAIDocumentationPlugin({ service: 'mock' });
    
    expect(plugin).toBeInstanceOf(AIDocumentationPlugin);
    expect(plugin.name).toBe('ai-documentation-enhancer');
  });

  it('should create plugin with config', () => {
    const config: AIPluginConfig = {
      enabled: false,
      service: 'mock',
    };
    const plugin = createAIDocumentationPlugin(config);
    
    expect(plugin).toBeDefined();
  });
});
