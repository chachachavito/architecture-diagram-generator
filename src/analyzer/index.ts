export { ArchitectureAnalyzer } from './ArchitectureAnalyzer';
export { RuleEngine } from './RuleEngine';
export { MetricsCalculator } from './MetricsCalculator';
export { AnalysisHistory } from './AnalysisHistory';
export type { HistoryEntry, HistoryDiff } from './AnalysisHistory';
export type { AnalysisResult, AnalysisRule, RuleConfig, ArchitectureMetrics } from './types';
export { ANALYSIS_SCHEMA_VERSION } from './types';
export { AnalyzerConfigSchema, parseAnalyzerConfig, toRuleOverrides, DEFAULT_ANALYZER_CONFIG } from './AnalyzerConfig';
export type { AnalyzerConfig, AnalyzerConfigInput } from './AnalyzerConfig';

// Presets
export { getPreset, PRESET_NAMES, PRESETS, PRESET_STRICT, PRESET_BALANCED, PRESET_RELAXED } from './presets';

// Rules
export { LayerViolationRule } from './rules/LayerViolationRule';
export { CircularDependencyRule } from './rules/CircularDependencyRule';
export { FanOutRule } from './rules/FanOutRule';
export { FanInRule } from './rules/FanInRule';
export { GodModuleRule } from './rules/GodModuleRule';
