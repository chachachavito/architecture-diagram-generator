import { ClassifiedGraph, AnalysisReport } from './GraphTypes';

/**
 * Standardized output schema for the Architecture Diagram Generator
 */
export interface Output {
  version: string;
  generatedAt?: string; // Optional timestamp
  graph: ClassifiedGraph;
  report?: AnalysisReport;
}

/**
 * Validates that the output object conforms to the Output interface.
 */
export function validateOutputSchema(output: unknown): output is Output {
  if (!output || typeof output !== 'object') return false;
  const o = output as Record<string, unknown>;
  if (typeof o.version !== 'string') return false;
  if (!o.graph || typeof o.graph !== 'object') return false;
  const g = o.graph as Record<string, unknown>;
  if (!Array.isArray(g.nodes) || !Array.isArray(g.edges)) return false;
  
  return true;
}
