// Parsers module exports
export { ASTParser } from './ASTParser';

// Sourced from ./types rather than ./ASTParser so that importing a parser type
// does not drag the parser — and its dependencies — along with it.
export type {
  ImportStatement,
  ExportStatement,
  ExternalCall,
  SourceLocation,
  InheritanceInfo,
  ModuleMetrics,
  ModuleMetadata,
  ParsedModule,
} from './types';

export { MermaidParser, MermaidPrettyPrinter, roundTripTest } from './MermaidParser';
export type {
  MermaidNode,
  MermaidEdge,
  MermaidSubgraph,
  MermaidStyle,
  MermaidAST,
  ParseResult,
  ParseError,
  ValidationResult as MermaidValidationResult,
} from './MermaidParser';
