import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginManager, type Plugin, type PluginHooks, type PluginContext } from './PluginManager';
import type { FullProjectConfig, PluginConfig } from './ConfigurationLoader';
import type { ParsedModule } from '../parsers/ASTParser';
import type { DependencyGraph } from './DependencyGraph';
import type { ClassifiedGraph } from './ArchitectureClassifier';
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

describe('PluginManager', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = new PluginManager();
  });

  describe('register', () => {
    it('should register a plugin', () => {
      const plugin = createMockPlugin('test-plugin');
      manager.register(plugin);

      expect(manager.getPlugin('test-plugin')).toBe(plugin);
    });

    it('should warn when overwriting an existing plugin', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const plugin1 = createMockPlugin('test-plugin', {}, '1.0.0');
      const plugin2 = createMockPlugin('test-plugin', {}, '2.0.0');
      
      manager.register(plugin1);
      manager.register(plugin2);

      expect(warnSpy).toHaveBeenCalledWith(
        '[PluginManager] Plugin "test-plugin" is already registered. Overwriting.'
      );
      expect(manager.getPlugin('test-plugin')?.version).toBe('2.0.0');
      
      warnSpy.mockRestore();
    });

    it('should register plugin with context', () => {
      const plugin = createMockPlugin('test-plugin');
      const context: PluginContext = {
        config: { apiKey: 'test-key' },
        log: vi.fn(),
        enabled: true,
      };

      manager.register(plugin, context);

      expect(manager.getPlugin('test-plugin')).toBe(plugin);
    });
  });

  describe('unregister', () => {
    it('should unregister a plugin', () => {
      const plugin = createMockPlugin('test-plugin');
      manager.register(plugin);

      const result = manager.unregister('test-plugin');

      expect(result).toBe(true);
      expect(manager.getPlugin('test-plugin')).toBeUndefined();
    });

    it('should return false when unregistering non-existent plugin', () => {
      const result = manager.unregister('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getPlugin', () => {
    it('should return registered plugin', () => {
      const plugin = createMockPlugin('test-plugin');
      manager.register(plugin);

      expect(manager.getPlugin('test-plugin')).toBe(plugin);
    });

    it('should return undefined for non-existent plugin', () => {
      expect(manager.getPlugin('non-existent')).toBeUndefined();
    });
  });

  describe('getAllPlugins', () => {
    it('should return all registered plugins', () => {
      const plugin1 = createMockPlugin('plugin-1');
      const plugin2 = createMockPlugin('plugin-2');
      
      manager.register(plugin1);
      manager.register(plugin2);

      const plugins = manager.getAllPlugins();

      expect(plugins).toHaveLength(2);
      expect(plugins).toContainEqual(plugin1);
      expect(plugins).toContainEqual(plugin2);
    });

    it('should return empty array when no plugins registered', () => {
      expect(manager.getAllPlugins()).toEqual([]);
    });
  });

  describe('registerFromConfig', () => {
    it('should register plugins from configuration', () => {
      const plugin = createMockPlugin('test-plugin');
      const factory = vi.fn().mockReturnValue(plugin);
      const factories = new Map([['test-plugin', factory]]);
      
      const configs: PluginConfig[] = [
        { name: 'test-plugin', enabled: true, config: { key: 'value' } },
      ];

      manager.registerFromConfig(configs, factories);

      expect(factory).toHaveBeenCalledWith({ key: 'value' });
      expect(manager.getPlugin('test-plugin')).toBe(plugin);
    });

    it('should warn for unknown plugins', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const configs: PluginConfig[] = [
        { name: 'unknown-plugin', enabled: true },
      ];

      manager.registerFromConfig(configs, new Map());

      expect(warnSpy).toHaveBeenCalledWith(
        '[PluginManager] Unknown plugin "unknown-plugin". Skipping.'
      );
      
      warnSpy.mockRestore();
    });
  });

  describe('execute', () => {
    it('should execute beforeDiscovery hook on all plugins', async () => {
      const hook1 = vi.fn();
      const hook2 = vi.fn();
      
      const plugin1 = createMockPlugin('plugin-1', { beforeDiscovery: hook1 });
      const plugin2 = createMockPlugin('plugin-2', { beforeDiscovery: hook2 });
      
      manager.register(plugin1);
      manager.register(plugin2);

      const config = createMockConfig();
      const results = await manager.execute('beforeDiscovery', config);

      expect(hook1).toHaveBeenCalledWith(config);
      expect(hook2).toHaveBeenCalledWith(config);
      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should execute afterParsing hook with parsed modules', async () => {
      const hook = vi.fn();
      const plugin = createMockPlugin('test-plugin', { afterParsing: hook });
      manager.register(plugin);

      const modules = [createMockParsedModule()];
      const results = await manager.execute('afterParsing', modules);

      expect(hook).toHaveBeenCalledWith(modules);
      expect(results[0].success).toBe(true);
    });

    it('should execute beforeClassification hook with graph', async () => {
      const hook = vi.fn();
      const plugin = createMockPlugin('test-plugin', { beforeClassification: hook });
      manager.register(plugin);

      const graph = createMockGraph();
      const results = await manager.execute('beforeClassification', graph);

      expect(hook).toHaveBeenCalledWith(graph);
      expect(results[0].success).toBe(true);
    });

    it('should execute afterClassification hook with classified graph', async () => {
      const hook = vi.fn();
      const plugin = createMockPlugin('test-plugin', { afterClassification: hook });
      manager.register(plugin);

      const graph = createMockClassifiedGraph();
      const results = await manager.execute('afterClassification', graph);

      expect(hook).toHaveBeenCalledWith(graph);
      expect(results[0].success).toBe(true);
    });

    it('should execute beforeGeneration hook with classified graph', async () => {
      const hook = vi.fn();
      const plugin = createMockPlugin('test-plugin', { beforeGeneration: hook });
      manager.register(plugin);

      const graph = createMockClassifiedGraph();
      const results = await manager.execute('beforeGeneration', graph);

      expect(hook).toHaveBeenCalledWith(graph);
      expect(results[0].success).toBe(true);
    });

    it('should execute afterGeneration hook with diagram', async () => {
      const hook = vi.fn();
      const plugin = createMockPlugin('test-plugin', { afterGeneration: hook });
      manager.register(plugin);

      const diagram = createMockDiagram();
      const results = await manager.execute('afterGeneration', diagram);

      expect(hook).toHaveBeenCalledWith(diagram);
      expect(results[0].success).toBe(true);
    });

    it('should skip plugins that do not implement the hook', async () => {
      const plugin = createMockPlugin('test-plugin', {}); // No hooks
      manager.register(plugin);

      const results = await manager.execute('beforeDiscovery', createMockConfig());

      expect(results).toHaveLength(0);
    });

    it('should skip disabled plugins', async () => {
      const hook = vi.fn();
      const plugin = createMockPlugin('test-plugin', { beforeDiscovery: hook });
      manager.register(plugin, { enabled: false, log: vi.fn() });

      const results = await manager.execute('beforeDiscovery', createMockConfig());

      expect(hook).not.toHaveBeenCalled();
      expect(results).toHaveLength(0);
    });

    it('should isolate plugin errors and continue execution', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const failingHook = vi.fn().mockImplementation(() => {
        throw new Error('Plugin error');
      });
      const successHook = vi.fn();
      
      const plugin1 = createMockPlugin('failing-plugin', { beforeDiscovery: failingHook });
      const plugin2 = createMockPlugin('success-plugin', { beforeDiscovery: successHook });
      
      manager.register(plugin1);
      manager.register(plugin2);

      const results = await manager.execute('beforeDiscovery', createMockConfig());

      expect(failingHook).toHaveBeenCalled();
      expect(successHook).toHaveBeenCalled();
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Plugin error');
      expect(results[1].success).toBe(true);
      
      expect(errorSpy).toHaveBeenCalledWith(
        '[PluginManager] Plugin "failing-plugin" hook "beforeDiscovery" failed: Plugin error'
      );
      
      errorSpy.mockRestore();
    });

    it('should record execution duration', async () => {
      const plugin = createMockPlugin('test-plugin', {
        beforeDiscovery: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
        },
      });
      manager.register(plugin);

      const results = await manager.execute('beforeDiscovery', createMockConfig());

      expect(results[0].duration).toBeGreaterThanOrEqual(10);
    });

    it('should support async hooks', async () => {
      const hook = vi.fn().mockResolvedValue(undefined);
      const plugin = createMockPlugin('test-plugin', { beforeDiscovery: hook });
      manager.register(plugin);

      const results = await manager.execute('beforeDiscovery', createMockConfig());

      expect(hook).toHaveBeenCalled();
      expect(results[0].success).toBe(true);
    });
  });

  describe('hasHookImplementation', () => {
    it('should return true when a plugin implements the hook', () => {
      const plugin = createMockPlugin('test-plugin', { beforeDiscovery: vi.fn() });
      manager.register(plugin);

      expect(manager.hasHookImplementation('beforeDiscovery')).toBe(true);
    });

    it('should return false when no plugin implements the hook', () => {
      const plugin = createMockPlugin('test-plugin', {});
      manager.register(plugin);

      expect(manager.hasHookImplementation('beforeDiscovery')).toBe(false);
    });

    it('should return false when no plugins registered', () => {
      expect(manager.hasHookImplementation('beforeDiscovery')).toBe(false);
    });
  });

  describe('getPluginsWithHook', () => {
    it('should return names of plugins that implement the hook', () => {
      const plugin1 = createMockPlugin('plugin-1', { beforeDiscovery: vi.fn() });
      const plugin2 = createMockPlugin('plugin-2', { beforeDiscovery: vi.fn() });
      const plugin3 = createMockPlugin('plugin-3', {});
      
      manager.register(plugin1);
      manager.register(plugin2);
      manager.register(plugin3);

      const names = manager.getPluginsWithHook('beforeDiscovery');

      expect(names).toContain('plugin-1');
      expect(names).toContain('plugin-2');
      expect(names).not.toContain('plugin-3');
    });

    it('should return empty array when no plugins implement the hook', () => {
      const plugin = createMockPlugin('test-plugin', {});
      manager.register(plugin);

      expect(manager.getPluginsWithHook('beforeDiscovery')).toEqual([]);
    });
  });

  describe('execution log', () => {
    it('should record execution results in log', async () => {
      const plugin = createMockPlugin('test-plugin', { beforeDiscovery: vi.fn() });
      manager.register(plugin);

      await manager.execute('beforeDiscovery', createMockConfig());

      const log = manager.getExecutionLog();
      expect(log).toHaveLength(1);
      expect(log[0].pluginName).toBe('test-plugin');
      expect(log[0].hookName).toBe('beforeDiscovery');
    });

    it('should accumulate log entries across multiple executions', async () => {
      const plugin = createMockPlugin('test-plugin', {
        beforeDiscovery: vi.fn(),
        afterParsing: vi.fn(),
      });
      manager.register(plugin);

      await manager.execute('beforeDiscovery', createMockConfig());
      await manager.execute('afterParsing', []);

      const log = manager.getExecutionLog();
      expect(log).toHaveLength(2);
    });

    it('should clear execution log', async () => {
      const plugin = createMockPlugin('test-plugin', { beforeDiscovery: vi.fn() });
      manager.register(plugin);

      await manager.execute('beforeDiscovery', createMockConfig());
      expect(manager.getExecutionLog()).toHaveLength(1);

      manager.clearExecutionLog();
      expect(manager.getExecutionLog()).toHaveLength(0);
    });
  });
});
