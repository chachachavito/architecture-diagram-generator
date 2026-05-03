import {
  ClassifiedGraph,
  Issue,
  IssueSeverity,
  Suggestion,
} from '../core/GraphTypes';

// ── Schema Version ───────────────────────────────────────────────────────────
// Bump when AnalysisResult shape changes in a breaking way.
// Minor additions (new optional fields) do NOT require a bump.
export const ANALYSIS_SCHEMA_VERSION = '1.0.0';

// ── Rule Contract ────────────────────────────────────────────────────────────

export interface RuleConfig {
  enabled: boolean;
  severity: IssueSeverity;
  thresholds?: Record<string, number>;
}


export interface AnalysisRule {
  id: string;
  name: string;
  category: 'coupling' | 'layering' | 'structure' | 'hygiene';
  defaultSeverity: IssueSeverity;
  run(graph: ClassifiedGraph, config?: RuleConfig): Issue[];
}

// ── Metrics ──────────────────────────────────────────────────────────────────

export interface ArchitectureMetrics {
  totalNodes: number;
  totalEdges: number;
  avgFanIn: number;
  avgFanOut: number;
  maxFanIn: { nodeId: string; value: number };
  maxFanOut: { nodeId: string; value: number };
  circularDependencies: number;
  layerViolations: number;
  layerDistribution: Record<string, number>;
}

// ── Result ───────────────────────────────────────────────────────────────────

/**
 * AnalysisResult is the stable output contract of the architecture analyzer.
 * 
 * Schema version: see ANALYSIS_SCHEMA_VERSION
 * 
 * - `score`: 0–100 health score (higher = healthier)
 * - `issues`: list of detected architectural violations
 * - `metrics`: structural metrics computed from the dependency graph
 * - `summary`: aggregated counts for quick consumption
 * - `schemaVersion`: version of this schema for forward compatibility
 */
export interface AnalysisResult {
  schemaVersion?: string;
  score: number;
  issues: Issue[];
  suggestions: Suggestion[];
  metrics: ArchitectureMetrics;
  summary: {
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    layerViolations: number;
    cycles: number;
  };
}

export { IssueSeverity };
