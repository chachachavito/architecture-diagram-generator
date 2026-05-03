import { 
  Issue, 
  IssueSeverity, 
  AnalysisReport as CoreAnalysisReport 
} from '../core/GraphTypes';

export interface GraphMetadata {
  type?: string;
  label?: string;
  layer?: string;
  domain?: string;
  metrics?: {
    sloc?: number;
    complexity?: number;
    [key: string]: any;
  };
  [key: string]: any;
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

// ── Analysis Report (mirrors core output) ──────────────────────────────────
export { Issue, IssueSeverity };

export type AnalysisReport = CoreAnalysisReport;
