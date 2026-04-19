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
export function validateOutputSchema(output: any): output is Output {
  if (!output || typeof output !== 'object') return false;
  if (typeof output.version !== 'string') return false;
  if (!output.graph || typeof output.graph !== 'object') return false;
  if (!Array.isArray(output.graph.nodes) || !Array.isArray(output.graph.edges)) return false;
  
  return true;
}
