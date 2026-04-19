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
export { VisualExporter } from './generators/VisualExporter';
export type { ExportOptions } from './generators/VisualExporter';


// Utils exports
export * from './utils';
