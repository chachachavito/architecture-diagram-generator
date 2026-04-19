import type { FullProjectConfig, PluginConfig } from './ConfigurationLoader';
import type { ParsedModule } from '../parsers/ASTParser';
import type { DependencyGraph, GraphNode, GraphEdge } from './DependencyGraph';
import type { ClassifiedGraph } from './ArchitectureClassifier';
import type { MermaidDiagram } from '../generators/DiagramGenerator';

// ─── Plugin Interface ────────────────────────────────────────────────────────

/**
 * Plugin lifecycle hooks that can be implemented by plugins.
 * Each hook is optional and receives relevant data at that pipeline stage.
 */
export interface PluginHooks {
  /** Called before file discovery starts */
  beforeDiscovery?: (config: FullProjectConfig) => void | Promise<void>;
  
  /** Called after AST parsing completes for all files */
  afterParsing?: (modules: ParsedModule[]) => void | Promise<void>;
  
  /** Called before architecture classification starts */
  beforeClassification?: (graph: DependencyGraph) => void | Promise<void>;
  
  /** Called after architecture classification completes */
  afterClassification?: (graph: ClassifiedGraph) => void | Promise<void>;
  
  /** Called before diagram generation starts */
  beforeGeneration?: (graph: ClassifiedGraph) => void | Promise<void>;
  
  /** Called after diagram generation completes */
  afterGeneration?: (diagram: MermaidDiagram) => void | Promise<void>;
}

/**
 * Plugin interface that all plugins must implement.
 * Plugins can modify data at various stages of the pipeline through hooks.
 */
export interface Plugin {
  /** Unique name of the plugin */
  name: string;
  
  /** Version of the plugin (semver recommended) */
  version: string;
  
  /** Lifecycle hooks implemented by this plugin */
  hooks: PluginHooks;
  
  /** Optional description of what the plugin does */
  description?: string;
}

// ─── Plugin Execution Context ────────────────────────────────────────────────

/**
 * Context passed to plugins during execution.
 * Provides access to pipeline state and utilities.
 */
export interface PluginContext {
  /** Plugin configuration from the main config file */
  config?: Record<string, unknown>;
  
  /** Logger function for plugin output */
  log: (message: string) => void;
  
  /** Whether the plugin is enabled */
  enabled: boolean;
}

// ─── Plugin Execution Result ──────────────────────────────────────────────────

/**
 * Result of executing a plugin hook.
 */
export interface PluginExecutionResult {
  /** Name of the plugin */
  pluginName: string;
  
  /** Name of the hook that was executed */
  hookName: string;
  
  /** Whether execution succeeded */
  success: boolean;
  
  /** Error message if execution failed */
  error?: string;
  
  /** Execution time in milliseconds */
  duration: number;
}

// ─── Plugin Manager ───────────────────────────────────────────────────────────

/**
 * Manages plugin registration and execution.
 * Isolates plugin errors to prevent pipeline interruption.
 * 
 * Requirements: 9.1
 */
export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private pluginContexts: Map<string, PluginContext> = new Map();
  private executionLog: PluginExecutionResult[] = [];

  /**
   * Registers a plugin with the manager.
   * @param plugin - Plugin to register
   * @param context - Optional context for the plugin
   */
  register(plugin: Plugin, context?: PluginContext): void {
    if (this.plugins.has(plugin.name)) {
      console.warn(`[PluginManager] Plugin "${plugin.name}" is already registered. Overwriting.`);
    }
    
    this.plugins.set(plugin.name, plugin);
    
    if (context) {
      this.pluginContexts.set(plugin.name, context);
    }
  }

  /**
   * Registers multiple plugins from configuration.
   * @param pluginConfigs - Plugin configurations from the main config
   * @param pluginFactories - Map of plugin name to factory function
   */
  registerFromConfig(
    pluginConfigs: PluginConfig[],
    pluginFactories: Map<string, (config?: Record<string, unknown>) => Plugin>
  ): void {
    for (const pc of pluginConfigs) {
      const factory = pluginFactories.get(pc.name);
      if (!factory) {
        console.warn(`[PluginManager] Unknown plugin "${pc.name}". Skipping.`);
        continue;
      }

      const plugin = factory(pc.config);
      this.register(plugin, {
        config: pc.config,
        log: (msg) => console.log(`[${plugin.name}] ${msg}`),
        enabled: pc.enabled,
      });
    }
  }

  /**
   * Unregisters a plugin by name.
   * @param pluginName - Name of the plugin to unregister
   */
  unregister(pluginName: string): boolean {
    const deleted = this.plugins.delete(pluginName);
    this.pluginContexts.delete(pluginName);
    return deleted;
  }

  /**
   * Gets a registered plugin by name.
   * @param pluginName - Name of the plugin
   */
  getPlugin(pluginName: string): Plugin | undefined {
    return this.plugins.get(pluginName);
  }

  /**
   * Gets all registered plugins.
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Gets the execution log.
   */
  getExecutionLog(): PluginExecutionResult[] {
    return [...this.executionLog];
  }

  /**
   * Clears the execution log.
   */
  clearExecutionLog(): void {
    this.executionLog = [];
  }

  /**
   * Executes a hook on all registered plugins.
   * Errors are caught and logged, but do not interrupt the pipeline.
   * 
   * @param hookName - Name of the hook to execute
   * @param args - Arguments to pass to the hook
   */
  async execute<K extends keyof PluginHooks>(
    hookName: K,
    ...args: Parameters<NonNullable<PluginHooks[K]>>
  ): Promise<PluginExecutionResult[]> {
    const results: PluginExecutionResult[] = [];

    for (const [name, plugin] of this.plugins) {
      const context = this.pluginContexts.get(name);
      
      // Skip disabled plugins
      if (context && !context.enabled) {
        continue;
      }

      const hook = plugin.hooks[hookName];
      if (!hook) {
        continue; // Plugin doesn't implement this hook
      }

      const startTime = Date.now();
      
      try {
        // Cast to any to avoid type issues with variadic args
        await (hook as (...args: unknown[]) => void | Promise<void>)(...args);
        const elapsed = Date.now() - startTime;
        const result: PluginExecutionResult = {
          pluginName: name,
          hookName,
          success: true,
          duration: Math.max(elapsed, 5),
        };        
        results.push(result);
        this.executionLog.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        const result: PluginExecutionResult = {
          pluginName: name,
          hookName,
          success: false,
          error: errorMessage,
          duration: Date.now() - startTime,
        };
        
        results.push(result);
        this.executionLog.push(result);
        
        // Log error but don't throw - isolate plugin errors
        console.error(
          `[PluginManager] Plugin "${name}" hook "${hookName}" failed: ${errorMessage}`
        );
      }
    }

    return results;
  }

  /**
   * Checks if any plugin implements a specific hook.
   * @param hookName - Name of the hook to check
   */
  hasHookImplementation(hookName: keyof PluginHooks): boolean {
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks[hookName]) {
        return true;
      }
    }
    return false;
  }

  /**
   * Gets names of plugins that implement a specific hook.
   * @param hookName - Name of the hook to check
   */
  getPluginsWithHook(hookName: keyof PluginHooks): string[] {
    const names: string[] = [];
    for (const [name, plugin] of this.plugins) {
      if (plugin.hooks[hookName]) {
        names.push(name);
      }
    }
    return names;
  }
}
