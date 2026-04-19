import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PluginManager, type Plugin, type PluginHooks } from '../core/PluginManager';
import type { FullProjectConfig } from '../core/ConfigurationLoader';
import type { ParsedModule } from '../parsers/ASTParser';
import type { DependencyGraph } from '../core/DependencyGraph';
import type { ClassifiedGraph } from '../core/ArchitectureClassifier';
import type { MermaidDiagram } from '../generators/DiagramGenerator';

// ─── Test Fixtures ────────────────────────────────────────────────────────────

const createMockPlugin = (
  name: string,
  hooks: Partial<PluginHooks> = {},
  version: string = '1.0.0'
): Plugin => ({
  name,
  version,
  hooks,
  description: `Test plugin: ${name}`,
});

const createMockConfig = (): FullProjectConfig => ({
  rootDir: './',
  include: ['app/**'],
  exclude: [],
  layers: [],
  domains: [],
  externalServices: [],
  output: {
    formats: ['markdown'],
    directory: './docs',
    simplified: true,
    detailed: false,
  },
  plugins: [],
});

const createMockParsedModule = (): ParsedModule => ({
  path: 'app/test.ts',
  imports: [],
  exports: [],
  externalCalls: [],
  metadata: {},
});

const createMockGraph = (): DependencyGraph => ({
  nodes: new Map([
    ['app/test.ts', {
      id: 'app/test.ts',
      type: 'component',
      externalCalls: [],
    }],
  ]),
  edges: [],
});

const createMockClassifiedGraph = (): ClassifiedGraph => {
  const graph = createMockGraph();
  return {
    ...graph,
    layers: new Map([['UI', [graph.nodes.get('app/test.ts')!]]]),
    domains: new Map(),
  };
};

const createMockDiagram = (): MermaidDiagram => ({
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

describe('CLI Plugin Integration', () => {
  let manager: PluginManager;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    manager = new PluginManager();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('Pipeline Hook Execution Order', () => {
    it('should execute hooks in correct order during pipeline', async () => {
      const hookOrder: string[] = [];
      
      const plugin: Plugin = createMockPlugin('order-tracker', {
        beforeDiscovery: async () => { hookOrder.push('beforeDiscovery'); },
        afterParsing: async () => { hookOrder.push('afterParsing'); },
        beforeClassification: async () => { hookOrder.push('beforeClassification'); },
        afterClassification: async () => { hookOrder.push('afterClassification'); },
        beforeGeneration: async () => { hookOrder.push('beforeGeneration'); },
        afterGeneration: async () => { hookOrder.push('afterGeneration'); },
      });
      
      manager.register(plugin);
      
      // Simulate pipeline execution order
      await manager.execute('beforeDiscovery', createMockConfig());
      await manager.execute('afterParsing', [createMockParsedModule()]);
      await manager.execute('beforeClassification', createMockGraph());
      await manager.execute('afterClassification', createMockClassifiedGraph());
      await manager.execute('beforeGeneration', createMockClassifiedGraph());
      await manager.execute('afterGeneration', createMockDiagram());
      
      expect(hookOrder).toEqual([
        'beforeDiscovery',
        'afterParsing',
        'beforeClassification',
        'afterClassification',
        'beforeGeneration',
        'afterGeneration',
      ]);
    });

    it('should pass correct data to each hook', async () => {
      const receivedData: Record<string, unknown> = {};
      
      const config = createMockConfig();
      const modules = [createMockParsedModule()];
      const graph = createMockGraph();
      const classifiedGraph = createMockClassifiedGraph();
      const diagram = createMockDiagram();
      
      const plugin: Plugin = createMockPlugin('data-capture', {
        beforeDiscovery: async (c) => { receivedData.beforeDiscovery = c; },
        afterParsing: async (m) => { receivedData.afterParsing = m; },
        beforeClassification: async (g) => { receivedData.beforeClassification = g; },
        afterClassification: async (g) => { receivedData.afterClassification = g; },
        beforeGeneration: async (g) => { receivedData.beforeGeneration = g; },
        afterGeneration: async (d) => { receivedData.afterGeneration = d; },
      });
      
      manager.register(plugin);
      
      await manager.execute('beforeDiscovery', config);
      await manager.execute('afterParsing', modules);
      await manager.execute('beforeClassification', graph);
      await manager.execute('afterClassification', classifiedGraph);
      await manager.execute('beforeGeneration', classifiedGraph);
      await manager.execute('afterGeneration', diagram);
      
      expect(receivedData.beforeDiscovery).toBe(config);
      expect(receivedData.afterParsing).toBe(modules);
      expect(receivedData.beforeClassification).toBe(graph);
      expect(receivedData.afterClassification).toBe(classifiedGraph);
      expect(receivedData.beforeGeneration).toBe(classifiedGraph);
      expect(receivedData.afterGeneration).toBe(diagram);
    });
  });

  describe('Plugin Error Isolation in Pipeline', () => {
    it('should not interrupt pipeline when plugin throws in beforeDiscovery', async () => {
      const errorPlugin = createMockPlugin('error-plugin', {
        beforeDiscovery: async () => { throw new Error('Discovery error'); },
      });
      
      const successPlugin = createMockPlugin('success-plugin', {
        beforeDiscovery: async () => {},
      });
      
      manager.register(errorPlugin);
      manager.register(successPlugin);
      
      // Pipeline should continue despite error
      await manager.execute('beforeDiscovery', createMockConfig());
      
      // Both plugins should have been attempted
      const log = manager.getExecutionLog();
      expect(log).toHaveLength(2);
      expect(log[0].success).toBe(false);
      expect(log[1].success).toBe(true);
    });

    it('should not interrupt pipeline when plugin throws in afterGeneration', async () => {
      const errorPlugin = createMockPlugin('error-plugin', {
        afterGeneration: async () => { throw new Error('Generation error'); },
      });
      
      const successPlugin = createMockPlugin('success-plugin', {
        afterGeneration: async () => {},
      });
      
      manager.register(errorPlugin);
      manager.register(successPlugin);
      
      await manager.execute('afterGeneration', createMockDiagram());
      
      const log = manager.getExecutionLog();
      expect(log).toHaveLength(2);
      expect(log[0].success).toBe(false);
      expect(log[1].success).toBe(true);
    });
  });

  describe('Multiple Plugin Coordination', () => {
    it('should execute plugins in registration order', async () => {
      const executionOrder: string[] = [];
      
      const plugin1 = createMockPlugin('plugin-1', {
        beforeDiscovery: async () => { executionOrder.push('plugin-1'); },
      });
      
      const plugin2 = createMockPlugin('plugin-2', {
        beforeDiscovery: async () => { executionOrder.push('plugin-2'); },
      });
      
      const plugin3 = createMockPlugin('plugin-3', {
        beforeDiscovery: async () => { executionOrder.push('plugin-3'); },
      });
      
      manager.register(plugin1);
      manager.register(plugin2);
      manager.register(plugin3);
      
      await manager.execute('beforeDiscovery', createMockConfig());
      
      expect(executionOrder).toEqual(['plugin-1', 'plugin-2', 'plugin-3']);
    });

    it('should allow plugins to modify data through references', async () => {
      const modules = [createMockParsedModule()];
      
      const modifierPlugin = createMockPlugin('modifier', {
        afterParsing: async (m) => {
          // Modify the modules array
          m.push({
            path: 'added-by-plugin.ts',
            imports: [],
            exports: [],
            externalCalls: [],
            metadata: { addedByPlugin: true },
          });
        },
      });
      
      manager.register(modifierPlugin);
      await manager.execute('afterParsing', modules);
      
      expect(modules).toHaveLength(2);
      expect(modules[1].path).toBe('added-by-plugin.ts');
    });
  });

  describe('Plugin Registration from Config', () => {
    it('should register plugins from configuration', () => {
      const plugin = createMockPlugin('test-plugin');
      const factory = vi.fn().mockReturnValue(plugin);
      const factories = new Map([['test-plugin', factory]]);
      
      const configs = [
        { name: 'test-plugin', enabled: true, config: { key: 'value' } },
      ];
      
      manager.registerFromConfig(configs, factories);
      
      expect(factory).toHaveBeenCalledWith({ key: 'value' });
      expect(manager.getPlugin('test-plugin')).toBe(plugin);
    });

    it('should skip disabled plugins during execution', async () => {
      const hook = vi.fn();
      const plugin = createMockPlugin('disabled-plugin', {
        beforeDiscovery: hook,
      });
      
      manager.register(plugin, { enabled: false, log: vi.fn() });
      
      await manager.execute('beforeDiscovery', createMockConfig());
      
      expect(hook).not.toHaveBeenCalled();
    });

    it('should warn when unknown plugin is in config', () => {
      const configs = [
        { name: 'unknown-plugin', enabled: true },
      ];
      
      manager.registerFromConfig(configs, new Map());
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[PluginManager] Unknown plugin "unknown-plugin". Skipping.'
      );
    });
  });

  describe('Execution Log for Pipeline Monitoring', () => {
    it('should track all hook executions in log', async () => {
      const plugin = createMockPlugin('tracked-plugin', {
        beforeDiscovery: async () => {},
        afterParsing: async () => {},
        afterGeneration: async () => {},
      });
      
      manager.register(plugin);
      
      await manager.execute('beforeDiscovery', createMockConfig());
      await manager.execute('afterParsing', []);
      await manager.execute('afterGeneration', createMockDiagram());
      
      const log = manager.getExecutionLog();
      
      expect(log).toHaveLength(3);
      expect(log.map(l => l.hookName)).toEqual([
        'beforeDiscovery',
        'afterParsing',
        'afterGeneration',
      ]);
      expect(log.every(l => l.success)).toBe(true);
    });

    it('should record execution duration for performance monitoring', async () => {
      const plugin = createMockPlugin('slow-plugin', {
        beforeDiscovery: async () => {
          await new Promise(resolve => setTimeout(resolve, 5));
        },
      });
      
      manager.register(plugin);
      
      await manager.execute('beforeDiscovery', createMockConfig());
      
      const log = manager.getExecutionLog();
      expect(log[0].duration).toBeGreaterThanOrEqual(5);
    });
  });
});
