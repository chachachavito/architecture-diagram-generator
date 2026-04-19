import { 
  ClassifiedGraph, 
  GraphSnapshot, 
  AnalysisReport,
  ArchitectureLayer 
} from '../core/GraphTypes';
import { VisualMapper } from './VisualMapper';
import { MermaidRenderer } from './MermaidRenderer';

/**
 * Interface for diagram generation options
 */
export interface GenerationOptions {
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  includeExternalServices?: boolean;
  groupByLayer?: boolean;
}

/**
 * Interface representing generated Mermaid diagram
 */
export interface MermaidDiagram {
  syntax: string;
  metadata: DiagramMetadata;
  extraContent?: string;
}

/**
 * Interface for diagram metadata
 */
export interface DiagramMetadata {
  nodeCount: number;
  edgeCount: number;
  generatedAt: Date;
  layers?: string[];
  domains?: string[];
  externalServices?: string[];
}

/**
 * DiagramGenerator orchestrates the visual representation of the architecture.
 */
export class DiagramGenerator {
  private visualMapper = new VisualMapper();
  private mermaidRenderer = new MermaidRenderer();

  /**
   * Generates a Mermaid diagram from architectural data.
   */
  generate(graph: GraphSnapshot, report: AnalysisReport, options: GenerationOptions = {}): MermaidDiagram {
    const visualTokens = this.visualMapper.map(graph, report.issues);
    const syntax = this.mermaidRenderer.render(graph, visualTokens);

    return {
      syntax,
      metadata: {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        generatedAt: new Date()
      }
    };
  }
}
