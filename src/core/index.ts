// Core module exports
export { FileDiscovery } from './FileDiscovery';
export type { FileList, ProjectConfig } from './FileDiscovery';

export { DependencyGraph } from './DependencyGraph';
export type {
  GraphNode,
  GraphEdge,
  NodeType,
  ArchitectureLayer,
  EdgeType,
} from './DependencyGraph';

export { DependencyGraphBuilder } from './DependencyGraphBuilder';
export { ArchitectureFilter } from './ArchitectureFilter';
export type { FilterResult } from './ArchitectureFilter';

export { ArchitectureClassifier, DEFAULT_CLASSIFICATION_RULES } from './ArchitectureClassifier';
export type { ClassificationRule, ClassifiedGraph } from './ArchitectureClassifier';

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
