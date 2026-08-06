/**
 * Structural types produced by the parser.
 *
 * These live apart from ASTParser deliberately. ModuleCache needs ParsedModule
 * and used to reach it through the parsers barrel, which re-exports ASTParser,
 * which imports ModuleCache — a cycle the tool could not see until directory
 * imports started resolving. Keeping the types in a module that imports
 * nothing lets both sides depend on a leaf.
 */

/**
 * Interface representing an import statement in a module
 */
export interface ImportStatement {
  source: string;        // Path of imported module
  specifiers: string[];  // Imported names
  isExternal: boolean;   // If it's external dependency (node_modules)
  isTypeOnly: boolean;   // If it's a type-only import
  importKind?: 'named' | 'default' | 'namespace' | 'side-effect' | 'dynamic' | 'require';
}

/**
 * Interface representing an export statement in a module
 */
export interface ExportStatement {
  name: string;          // Name of the exported symbol
  type: 'function' | 'class' | 'variable' | 'type' | 'default';
  isDefault: boolean;
}

/**
 * Interface representing an external call (e.g., fetch, axios)
 */
export interface ExternalCall {
  type: 'fetch' | 'axios' | 'database' | 'unknown';
  target: string;        // URL or identifier of the service
  location: SourceLocation;
}

/**
 * Interface representing a source location in a file
 */
export interface SourceLocation {
  line: number;
  column?: number;
}

export interface InheritanceInfo {
  name: string;
  type: 'extends' | 'implements';
  module?: string;
}

export interface ModuleMetrics {
  complexity: number;
  sloc: number;
}

/**
 * Interface representing module metadata
 */
export interface ModuleMetadata {
  hasDefaultExport: boolean;
  isReactComponent: boolean;
  isApiRoute: boolean;
  inheritance: InheritanceInfo[];
  decorators: string[];
  metrics: ModuleMetrics;
  /**
   * The module declares nothing of its own and only re-exports other modules
   * (`export ... from`). Its dependency count describes the surface it
   * aggregates, not coupling it introduces.
   */
  isBarrel: boolean;
  /**
   * Every export is a type or interface. Depending on such a module creates no
   * runtime edge — the import is erased at compile time.
   */
  isTypeOnlyModule: boolean;
}

/**
 * Interface representing a parsed module
 */
export interface ParsedModule {
  path: string;
  imports: ImportStatement[];
  exports: ExportStatement[];
  externalCalls: ExternalCall[];
  metadata: ModuleMetadata;
}
