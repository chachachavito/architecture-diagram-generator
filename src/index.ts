/**
 * Architecture Diagram Generator
 * Main entry point for library usage
 */

// Core exports
export * from './core';

// Parser exports (excluding ParseError which conflicts with utils)
export { ASTParser } from './parsers/ASTParser';
export type {
  ImportStatement,
  ExportStatement,
  ExternalCall,
  SourceLocation,
  ModuleMetadata,
  ParsedModule,
} from './parsers/ASTParser';
export { MermaidParser, MermaidPrettyPrinter, roundTripTest } from './parsers/MermaidParser';
export type {
  MermaidNode,
  MermaidEdge,
  MermaidSubgraph,
  MermaidStyle,
  MermaidAST,
  ParseResult,
  ValidationResult as MermaidValidationResult,
} from './parsers/MermaidParser';

// Generator exports (excluding types already in core)
export { DiagramGenerator } from './generators/DiagramGenerator';
export type { GenerationOptions, MermaidDiagram, DiagramMetadata } from './generators/DiagramGenerator';
export { VisualExporter } from './generators/VisualExporter';
export type { ExportOptions } from './generators/VisualExporter';

// Plugin exports
export * from './plugins';

// Utils exports
export * from './utils';
