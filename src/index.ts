/**
 * Architecture Diagram Generator
 * Main entry point for library usage
 */

// Core exports
export * from './core';

// Parser exports
export { ASTParser } from './parsers/ASTParser';
export type {
  ImportStatement,
  ExportStatement,
  ExternalCall,
  SourceLocation,
  ModuleMetadata,
  ParsedModule,
} from './parsers/ASTParser';
export { MermaidParser, MermaidPrettyPrinter } from './parsers/MermaidParser';
export type {
  MermaidNode,
  MermaidEdge,
  MermaidSubgraph,
  MermaidStyle,
  MermaidAST,
  ParseResult,
} from './parsers/MermaidParser';

// Generator exports
export { DiagramGenerator } from './generators/DiagramGenerator';
export type { GenerationOptions, MermaidDiagram, DiagramMetadata } from './generators/DiagramGenerator';
export { VisualMapper } from './generators/VisualMapper';
export type { VisualToken } from './generators/VisualMapper';
export { MermaidRenderer } from './generators/MermaidRenderer';
export { HTMLGenerator } from './generators/HTMLGenerator';

// Analyzer exports (public API)
export { ArchitectureAnalyzer } from './analyzer/ArchitectureAnalyzer';
export { RuleEngine } from './analyzer/RuleEngine';
export { MetricsCalculator } from './analyzer/MetricsCalculator';
export { AnalysisHistory } from './analyzer/AnalysisHistory';
export type { HistoryEntry, HistoryDiff } from './analyzer/AnalysisHistory';
export type { AnalysisResult, AnalysisRule, RuleConfig, ArchitectureMetrics } from './analyzer/types';
export { ANALYSIS_SCHEMA_VERSION } from './analyzer/types';
export { parseAnalyzerConfig, DEFAULT_ANALYZER_CONFIG, AnalyzerConfigSchema } from './analyzer/AnalyzerConfig';
export type { AnalyzerConfig, AnalyzerConfigInput } from './analyzer/AnalyzerConfig';

// Presets
export { getPreset, PRESET_NAMES, PRESETS, PRESET_STRICT, PRESET_BALANCED, PRESET_RELAXED } from './analyzer/presets';

// Built-in rules (for extension)
export { LayerViolationRule } from './analyzer/rules/LayerViolationRule';
export { CircularDependencyRule } from './analyzer/rules/CircularDependencyRule';
export { FanOutRule } from './analyzer/rules/FanOutRule';
export { FanInRule } from './analyzer/rules/FanInRule';
export { GodModuleRule } from './analyzer/rules/GodModuleRule';

// Utils exports
export * from './utils';
