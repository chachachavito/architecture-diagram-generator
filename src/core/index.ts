// Core module exports
export { FileDiscovery } from './FileDiscovery';
export type { FileList } from './FileDiscovery';

export * from './GraphTypes';
export { DependencyGraph } from './DependencyGraph';
export { DependencyGraphBuilder } from './DependencyGraphBuilder';
export { ArchitectureClassifier, DEFAULT_CLASSIFICATION_RULES } from './ArchitectureClassifier';
export { ArchitecturePipeline } from './ArchitecturePipeline';
export { ArchitectureAnalyzer } from './ArchitectureAnalyzer';
export { ConfigValidator, validateConfig } from './ConfigValidator';
export type { ProjectConfig } from './ConfigValidator';
export { Normalizer } from './Normalizer';
export { MetricsCalculator } from './MetricsCalculator';
export { validateOutputSchema } from './OutputTypes';
export type { Output } from './OutputTypes';

export { ArchitectureFilter } from './ArchitectureFilter';
export type { FilterResult } from './ArchitectureFilter';

export { ConfigurationLoader, DEFAULT_CONFIG } from './ConfigurationLoader';
export type {
  FullProjectConfig,
  LayerDefinition,
  DomainDefinition,
  ExternalServiceDefinition,
  OutputConfig,
  PluginConfig,
  ValidationResult,
} from './ConfigurationLoader';

export { ModuleCache } from './ModuleCache';
export type { CacheEntry, CacheStats } from './ModuleCache';

export { ParallelFileProcessor } from './ParallelFileProcessor';
export type { ParallelProcessingOptions, ProcessingResult } from './ParallelFileProcessor';

export { PluginManager } from './PluginManager';
export type {
  Plugin,
  PluginHooks,
  PluginContext,
  PluginExecutionResult,
} from './PluginManager';

export { MetadataGenerator, ChangeDetector, ChangeHighlighter } from './MetadataGenerator';
export type {
  ArchitectureMetadata,
  ChangeDetectionResult,
  NodeModification,
  EdgeChange,
} from './MetadataGenerator';
