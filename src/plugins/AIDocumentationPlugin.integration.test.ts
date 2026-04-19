import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// ─── Mock Fetch for AI API Testing ────────────────────────────────────────────

interface MockFetchOptions {
  shouldFail?: boolean;
  errorMessage?: string;
  statusCode?: number;
  responseContent?: string | string[];
  delay?: number;
}

const createMockFetch = (options: MockFetchOptions = {}) => {
  const {
    shouldFail = false,
    errorMessage = 'API Error',
    statusCode = 500,
    responseContent = 'Mock AI response',
    delay = 0,
  } = options;

  return vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    if (shouldFail) {
      return {
        ok: false,
        status: statusCode,
        statusText: errorMessage,
        json: async () => ({ error: { message: errorMessage } }),
      };
    }

    // Parse the request to understand what's being asked
    const body = JSON.parse(init.body as string || '{}');
    const isImprovementRequest = body.messages?.some(
      (m: { content: string }) => m.content?.includes('Suggest architecture improvements')
    );

    // Return appropriate mock response
    const content = isImprovementRequest
      ? JSON.stringify(Array.isArray(responseContent) ? responseContent : [responseContent])
      : responseContent;

    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: typeof content === 'string' ? content : JSON.stringify(content),
            },
          },
        ],
      }),
    };
  });
};

// Store original fetch
const originalFetch = global.fetch;

// ─── Integration Tests ────────────────────────────────────────────────────────

describe('AIDocumentationPlugin Integration Tests', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe('OpenAI API Integration', () => {
    it('should call OpenAI API with correct parameters for module descriptions', async () => {
      const mockFetch = createMockFetch({
        responseContent: 'This module handles user authentication and session management.',
      });
      global.fetch = mockFetch;

      const plugin = new AIDocumentationPlugin({
        service: 'openai',
        apiKey: 'test-api-key',
        model: 'gpt-4o-mini',
        maxTokens: 300,
        temperature: 0.5,
        generateModuleDescriptions: true,
        generateDomainDescriptions: false,
        suggestImprovements: false,
      });

      const nodes = [
        createNode('app/auth/login.ts', 'component', 'UI', 'Auth'),
      ];
      const graph = createClassifiedGraph(nodes);

      await plugin.analyzeGraph(graph);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
      
      const body = JSON.parse(init.body as string);
      expect(body.model).toBe('gpt-4o-mini');
      expect(body.max_tokens).toBe(300);
      expect(body.temperature).toBe(0.5);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[1].role).toBe('user');
      expect(init.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-api-key',
      });
    });

    it('should call OpenAI API for improvement suggestions', async () => {
      const mockFetch = createMockFetch({
        responseContent: [
          'Consider extracting authentication logic into a separate service',
          'Add proper error handling for failed login attempts',
        ],
      });
      global.fetch = mockFetch;

      const plugin = new AIDocumentationPlugin({
        service: 'openai',
        apiKey: 'test-api-key',
        generateModuleDescriptions: false,
        generateDomainDescriptions: false,
        suggestImprovements: true,
      });

      const nodes = [createNode('app/page.tsx', 'component', 'UI')];
      const layers = new Map([['UI', nodes]]);
      const graph = createClassifiedGraph(nodes, [], layers);

      await plugin.analyzeGraph(graph);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      // Check the user message contains the improvement request
      expect(body.messages[1].content).toContain('Suggest architecture improvements');
    });

    it('should handle OpenAI API rate limiting (429)', async () => {
      const mockFetch = createMockFetch({
        shouldFail: true,
        statusCode: 429,
        errorMessage: 'Rate limit exceeded',
      });
      global.fetch = mockFetch;

      const plugin = new AIDocumentationPlugin({
        service: 'openai',
        apiKey: 'test-api-key',
      });

      const nodes = [createNode('app/page.tsx', 'component', 'UI')];
      const graph = createClassifiedGraph(nodes);

      const result = await plugin.analyzeGraph(graph);

      // Should handle error gracefully and return empty results
      expect(result.moduleDescriptions).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should handle OpenAI API authentication errors (401)', async () => {
      const mockFetch = createMockFetch({
        shouldFail: true,
        statusCode: 401,
        errorMessage: 'Invalid API key',
      });
      global.fetch = mockFetch;

      const plugin = new AIDocumentationPlugin({
        service: 'openai',
        apiKey: 'invalid-key',
      });

      const nodes = [createNode('app/page.tsx', 'component', 'UI')];
      const graph = createClassifiedGraph(nodes);

      const result = await plugin.analyzeGraph(graph);

      expect(result.moduleDescriptions).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should handle OpenAI API server errors (500)', async () => {
      const mockFetch = createMockFetch({
        shouldFail: true,
        statusCode: 500,
        errorMessage: 'Internal server error',
      });
      global.fetch = mockFetch;

      const plugin = new AIDocumentationPlugin({
        service: 'openai',
        apiKey: 'test-api-key',
      });

      const nodes = [createNode('app/page.tsx', 'component', 'UI')];
      const graph = createClassifiedGraph(nodes);

      const result = await plugin.analyzeGraph(graph);

      expect(result.moduleDescriptions).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should handle network timeouts gracefully', async () => {
      const mockFetch = createMockFetch({
        shouldFail: true,
        errorMessage: 'Network timeout',
      });
      global.fetch = mockFetch;

      const plugin = new AIDocumentationPlugin({
        service: 'openai',
        apiKey: 'test-api-key',
      });

      const nodes = [createNode('app/page.tsx', 'component', 'UI')];
      const graph = createClassifiedGraph(nodes);

      // Should not throw
      const result = await plugin.analyzeGraph(graph);
      expect(result).toBeDefined();
    });
  });

  describe('Description Generation', () => {
    it('should generate descriptions for multiple modules', async () => {
      const mockFetch = createMockFetch({
        responseContent: 'Generated description for module',
      });
      global.fetch = mockFetch;

      const plugin = new AIDocumentationPlugin({
        service: 'openai',
        apiKey: 'test-api-key',
        generateModuleDescriptions: true,
        generateDomainDescriptions: false,
        suggestImprovements: false,
      });

      const nodes = [
        createNode('app/risk/page.tsx', 'component', 'UI', 'Risk'),
        createNode('app/weather/page.tsx', 'component', 'UI', 'Weather'),
        createNode('lib/utils.ts', 'utility', 'Processing'),
      ];
      const graph = createClassifiedGraph(nodes);

      const result = await plugin.analyzeGraph(graph);

      expect(result.moduleDescriptions).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      
      // Each module should have a description
      for (const desc of result.moduleDescriptions) {
        expect(desc.description).toBeDefined();
        expect(desc.confidence).toBeGreaterThan(0);
      }
    });

    it('should generate domain descriptions with module references', async () => {
      const mockFetch = createMockFetch({
        responseContent: 'Domain description for Risk module',
      });
      global.fetch = mockFetch;

      const plugin = new AIDocumentationPlugin({
        service: 'openai',
        apiKey: 'test-api-key',
        generateModuleDescriptions: false,
        generateDomainDescriptions: true,
        suggestImprovements: false,
      });

      const nodes = [
        createNode('app/risk/page.tsx', 'component', 'UI', 'Risk'),
        createNode('app/risk/calculator.ts', 'utility', 'Processing', 'Risk'),
      ];
      const domains = new Map([['Risk', nodes]]);
      const graph = createClassifiedGraph(nodes, [], undefined, domains);

      const result = await plugin.analyzeGraph(graph);

      expect(result.domainDescriptions).toHaveLength(1);
      expect(result.domainDescriptions[0].domainName).toBe('Risk');
      expect(result.domainDescriptions[0].modules).toHaveLength(2);
    });

    it('should include context information in API requests', async () => {
      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      const plugin = new AIDocumentationPlugin({
        service: 'openai',
        apiKey: 'test-api-key',
      });

      const node = createNode('app/api/users/route.ts', 'api', 'API', 'Users');
      node.externalCalls = [{ type: 'database', target: 'prisma.user.findMany', location: { line: 10 } }];
      
      const graph = createClassifiedGraph([node]);

      await plugin.analyzeGraph(graph);

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      const userMessage = body.messages[1].content;

      // Context should include module information
      expect(userMessage).toContain('app/api/users/route.ts');
      expect(userMessage).toContain('API');
      expect(userMessage).toContain('Users');
    });
  });

  describe('Configuration Options', () => {
    it('should respect enabled=false configuration', async () => {
      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      const plugin = new AIDocumentationPlugin({
        enabled: false,
        service: 'openai',
        apiKey: 'test-api-key',
      });

      const nodes = [createNode('app/page.tsx', 'component', 'UI')];
      const graph = createClassifiedGraph(nodes);

      // Call hook which checks enabled flag
      await plugin.hooks.afterClassification?.(graph);

      // Should not call API when disabled
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should use environment variable for API key if not provided', async () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'env-api-key';

      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      const plugin = new AIDocumentationPlugin({
        service: 'openai',
        // No apiKey provided - should use env var
      });

      const nodes = [createNode('app/page.tsx', 'component', 'UI')];
      const graph = createClassifiedGraph(nodes);

      await plugin.analyzeGraph(graph);

      const [, init] = mockFetch.mock.calls[0];
      expect(init.headers).toMatchObject({
        'Authorization': 'Bearer env-api-key',
      });

      process.env.OPENAI_API_KEY = originalEnv;
    });

    it('should skip generation when feature flags are false', async () => {
      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      const plugin = new AIDocumentationPlugin({
        service: 'openai',
        apiKey: 'test-api-key',
        generateModuleDescriptions: false,
        generateDomainDescriptions: false,
        suggestImprovements: false,
      });

      const nodes = [createNode('app/page.tsx', 'component', 'UI')];
      const graph = createClassifiedGraph(nodes);

      const result = await plugin.analyzeGraph(graph);

      // Should not call API when all features disabled
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.moduleDescriptions).toHaveLength(0);
      expect(result.domainDescriptions).toHaveLength(0);
      expect(result.improvements).toHaveLength(0);
    });

    it('should use custom model when specified', async () => {
      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      const plugin = new AIDocumentationPlugin({
        service: 'openai',
        apiKey: 'test-api-key',
        model: 'gpt-4',
      });

      const nodes = [createNode('app/page.tsx', 'component', 'UI')];
      const graph = createClassifiedGraph(nodes);

      await plugin.analyzeGraph(graph);

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.model).toBe('gpt-4');
    });
  });

  describe('Diagram Enhancement', () => {
    it('should enhance diagram with AI-generated descriptions', async () => {
      const mockFetch = createMockFetch({
        responseContent: 'AI-generated module description',
      });
      global.fetch = mockFetch;

      const plugin = new AIDocumentationPlugin({
        service: 'openai',
        apiKey: 'test-api-key',
      });

      const nodes = [createNode('app/page.tsx', 'component', 'UI')];
      const graph = createClassifiedGraph(nodes);
      const diagram = createDiagram();

      await plugin.hooks.afterClassification?.(graph);
      await plugin.hooks.afterGeneration?.(diagram);

      expect(diagram.syntax).toContain('AI-Generated Descriptions');
      expect(diagram.syntax).toContain('app/page.tsx');
      expect(diagram.syntax).toContain('AI-generated module description');
    });

    it('should add improvement suggestions to diagram', async () => {
      const mockFetch = createMockFetch({
        responseContent: ['Improve error handling', 'Add unit tests'],
      });
      global.fetch = mockFetch;

      const plugin = new AIDocumentationPlugin({
        service: 'openai',
        apiKey: 'test-api-key',
        generateModuleDescriptions: false,
        generateDomainDescriptions: false,
        suggestImprovements: true,
      });

      const nodes = [createNode('app/page.tsx', 'component', 'UI')];
      const layers = new Map([['UI', nodes]]);
      const graph = createClassifiedGraph(nodes, [], layers);
      const diagram = createDiagram();

      await plugin.hooks.afterClassification?.(graph);
      await plugin.hooks.afterGeneration?.(diagram);

      expect(diagram.syntax).toContain('Suggested Improvements');
      expect(diagram.syntax).toContain('Improve error handling');
      expect(diagram.syntax).toContain('Add unit tests');
    });

    it('should not modify diagram if analysis failed', async () => {
      const mockFetch = createMockFetch({
        shouldFail: true,
        errorMessage: 'API Error',
      });
      global.fetch = mockFetch;

      const plugin = new AIDocumentationPlugin({
        service: 'openai',
        apiKey: 'test-api-key',
      });

      const nodes = [createNode('app/page.tsx', 'component', 'UI')];
      const graph = createClassifiedGraph(nodes);
      const diagram = createDiagram();
      const originalSyntax = diagram.syntax;

      await plugin.hooks.afterClassification?.(graph);
      await plugin.hooks.afterGeneration?.(diagram);

      // Diagram should not be modified if no analysis result
      expect(diagram.syntax).toBe(originalSyntax);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should continue processing other modules when one fails', async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ error: { message: 'Error' } }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Success response' } }],
          }),
        };
      });
      global.fetch = mockFetch;

      const plugin = new AIDocumentationPlugin({
        service: 'openai',
        apiKey: 'test-api-key',
      });

      const nodes = [
        createNode('app/page1.tsx', 'component', 'UI'),
        createNode('app/page2.tsx', 'component', 'UI'),
      ];
      const graph = createClassifiedGraph(nodes);

      const result = await plugin.analyzeGraph(graph);

      // First module failed, second succeeded
      expect(result.moduleDescriptions).toHaveLength(1);
      expect(result.moduleDescriptions[0].moduleId).toBe('app/page2.tsx');
    });

    it('should handle malformed API responses gracefully', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => ({
        ok: true,
        json: async () => ({
          // Missing choices array
          error: 'Malformed response',
        }),
      }));
      global.fetch = mockFetch;

      const plugin = new AIDocumentationPlugin({
        service: 'openai',
        apiKey: 'test-api-key',
      });

      const nodes = [createNode('app/page.tsx', 'component', 'UI')];
      const graph = createClassifiedGraph(nodes);

      // Should not throw
      const result = await plugin.analyzeGraph(graph);
      expect(result.moduleDescriptions).toHaveLength(0);
    });

    it('should handle empty API responses', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '' } }],
        }),
      }));
      global.fetch = mockFetch;

      const plugin = new AIDocumentationPlugin({
        service: 'openai',
        apiKey: 'test-api-key',
      });

      const nodes = [createNode('app/page.tsx', 'component', 'UI')];
      const graph = createClassifiedGraph(nodes);

      const result = await plugin.analyzeGraph(graph);

      // Should handle empty content
      expect(result.moduleDescriptions).toHaveLength(1);
      expect(result.moduleDescriptions[0].description).toBe('');
    });
  });

  describe('Plugin Hook Integration', () => {
    it('should integrate with PluginManager lifecycle', async () => {
      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      const plugin = createAIDocumentationPlugin({
        service: 'openai',
        apiKey: 'test-api-key',
      });

      // Verify plugin interface
      expect(plugin.name).toBe('ai-documentation-enhancer');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.hooks.afterClassification).toBeDefined();
      expect(plugin.hooks.afterGeneration).toBeDefined();
    });

    it('should store analysis result for later retrieval', async () => {
      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      const plugin = new AIDocumentationPlugin({
        service: 'openai',
        apiKey: 'test-api-key',
      });

      const nodes = [createNode('app/page.tsx', 'component', 'UI')];
      const graph = createClassifiedGraph(nodes);

      expect(plugin.getAnalysisResult()).toBeUndefined();

      await plugin.analyzeGraph(graph);

      const result = plugin.getAnalysisResult();
      expect(result).toBeDefined();
      expect(result?.moduleDescriptions).toHaveLength(1);
    });

    it('should record analysis timestamp', async () => {
      const mockFetch = createMockFetch();
      global.fetch = mockFetch;

      const plugin = new AIDocumentationPlugin({
        service: 'openai',
        apiKey: 'test-api-key',
      });

      const nodes = [createNode('app/page.tsx', 'component', 'UI')];
      const graph = createClassifiedGraph(nodes);

      const beforeTime = new Date();
      await plugin.analyzeGraph(graph);
      const afterTime = new Date();

      const result = plugin.getAnalysisResult();
      const analyzedAt = new Date(result!.analyzedAt);

      expect(analyzedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(analyzedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('Mock Service (Default)', () => {
    it('should use mock service by default', async () => {
      const plugin = new AIDocumentationPlugin();

      const nodes = [createNode('app/page.tsx', 'component', 'UI')];
      const graph = createClassifiedGraph(nodes);

      const result = await plugin.analyzeGraph(graph);

      // Mock service should generate descriptions without API calls
      expect(result.moduleDescriptions).toHaveLength(1);
      expect(result.moduleDescriptions[0].description).toContain('app/page.tsx');
    });

    it('should generate mock improvement suggestions', async () => {
      const plugin = new AIDocumentationPlugin({
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
  });

  describe('Anthropic Service (Not Implemented)', () => {
    it('should fall back to mock service for Anthropic', async () => {
      const plugin = new AIDocumentationPlugin({
        service: 'anthropic',
        apiKey: 'test-api-key',
      });

      const nodes = [createNode('app/page.tsx', 'component', 'UI')];
      const graph = createClassifiedGraph(nodes);

      // Should warn about Anthropic not being implemented
      const result = await plugin.analyzeGraph(graph);

      // Should still work with mock fallback
      expect(result.moduleDescriptions).toHaveLength(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[AIPlugin] Anthropic service not implemented, using mock'
      );
    });
  });
});
