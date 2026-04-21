import { ExternalCall } from '../parsers';

/**
 * Core type definitions for the Architecture Diagram Generator
 */

export type NodeType = 'module' | 'service' | 'api' | 'external';
export type ArchitectureLayer = 'UI' | 'API' | 'Action' | 'Service' | 'Core' | 'External';
export type SourcePriority = 'inferred' | 'manual';
export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IssueCategory = 'coupling' | 'layering' | 'structure';

/**
 * Interface representing a node metadata
 */
export interface NodeMetadata {
  layer?: ArchitectureLayer;
  domain?: string;
  type: NodeType;
  source: SourcePriority;
  label?: string;
  inheritance?: any[];
  decorators?: string[];
  metrics?: any;
  [key: string]: any;
}

/**
 * Interface representing a node in the graph
 */
export interface GraphNode {
  id: string; // Absolute normalized path or consistent hash
  metadata: NodeMetadata;
  externalCalls?: ExternalCall[];
  
  // Legacy properties for backward compatibility
  type?: NodeType;
  layer?: ArchitectureLayer;
  domain?: string;
  label?: string;
}

/**
 * Interface representing an edge in the graph
 */
export interface GraphEdge {
  id: string; // Stable ID: from->to:type
  from: string;
  to: string;
  type: 'import' | 'external-call';
  isTypeOnly?: boolean;
}

/**
 * Raw graph structure as returned by the scanner
 */
export interface SourceGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Enriched graph structure after normalization and classification
 */
export interface ClassifiedGraph extends SourceGraph {
  version: string;
}

/**
 * Deeply frozen snapshot of the graph for analysis
 */
export interface GraphSnapshot extends ClassifiedGraph {}

/**
 * Performance thresholds and rule configurations
 */
export interface ArchitectureRules {
  ruleId: string;
  ruleVersion: string;
  enabled: boolean;
  severity: IssueSeverity;
  thresholds?: Record<string, number>;
  params?: Record<string, any>;
}

/**
 * Standardized issue report
 */
export interface Issue {
  ruleId: string;
  type: string;
  category: IssueCategory;
  nodeId: string;
  severity: IssueSeverity;
  message: string;
  confidence: number; // 0 to 1
}

/**
 * Standardized suggestion
 */
export interface Suggestion {
  id: string;
  relatedIssues: string[];
  message: string;
}

/**
 * Architecture analysis report
 */
export interface AnalysisReport {
  issues: Issue[];
  suggestions: Suggestion[];
  score: number; // 0 to 100
  summary: {
    totalIssues: number;
    criticalIssues: number;
    layerViolations: number;
    cycles: number;
  };
}

/**
 * Metrics structure for a node
 */
export interface NodeMetrics {
  inDegree: number;
  outDegree: number;
  dependencies: string[];
  dependents: string[];
}
