export interface GraphMetadata {
  type?: string;
  label?: string;
  layer?: string;
  domain?: string;
  metrics?: {
    sloc?: number;
    complexity?: number;
  };
}

export interface GraphNode {
  id: string;
  metadata: GraphMetadata;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  version?: string;
}

export interface IGraphRenderer {
  render(graph: GraphData, report?: AnalysisReport): {
    html: string;
    script: string;
    css: string;
  };
}

// ── Analysis Report (mirrors architecture-analyzer output) ──────────────────
export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Issue {
  ruleId: string;
  type: string;
  category: string;
  nodeId: string;
  severity: IssueSeverity;
  message: string;
  confidence: number;
  suggestions?: string[];
}

export interface AnalysisReport {
  issues: Issue[];
  score: number;
  summary: {
    totalIssues: number;
    criticalIssues: number;
    layerViolations: number;
    cycles: number;
  };
}
