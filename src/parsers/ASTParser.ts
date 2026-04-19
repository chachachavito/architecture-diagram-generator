import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ModuleCache } from '../core/ModuleCache';
import { FileReadError, ParseError } from '../utils/errors';

/**
 * Interface representing an import statement in a module
 */
export interface ImportStatement {
  source: string;        // Path of imported module
  specifiers: string[];  // Imported names
  isExternal: boolean;   // If it's external dependency (node_modules)
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

/**
 * Interface representing module metadata
 */
export interface ModuleMetadata {
  hasDefaultExport: boolean;
  isReactComponent: boolean;
  isApiRoute: boolean;
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

/**
 * ASTParser class handles parsing of TypeScript/JavaScript files
 * using the TypeScript Compiler API
 */
export class ASTParser {
  private rootDir: string;
  private cache?: ModuleCache;

  constructor(rootDir: string, cache?: ModuleCache) {
    this.rootDir = rootDir;
    this.cache = cache;
  }

  /**
   * Parses a TypeScript/JavaScript file and extracts structural information
   * @param filePath - Relative or absolute path to the file
   * @returns Promise<ParsedModule> - Parsed module information
   */
  async parse(filePath: string): Promise<ParsedModule> {
    // Resolve to absolute path if needed
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(this.rootDir, filePath);

    // Check cache first
    if (this.cache) {
      const cached = await this.cache.get(absolutePath);
      if (cached) {
        return cached;
      }
    }

    // Read file content
    let content: string;
    try {
      content = await fs.readFile(absolutePath, 'utf-8');
    } catch (error) {
      throw new FileReadError(filePath, error instanceof Error ? error : new Error(String(error)));
    }

    // Create source file
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    // Extract imports and exports
    const imports = this.extractImports(sourceFile, filePath);
    const exports = this.extractExports(sourceFile);
    const externalCalls = this.detectExternalCalls(sourceFile);
    const metadata = this.extractMetadata(sourceFile, exports, filePath);

    const result: ParsedModule = {
      path: filePath,
      imports,
      exports,
      externalCalls,
      metadata,
    };

    // Store in cache
    if (this.cache) {
      await this.cache.set(absolutePath, result);
    }

    return result;
  }

  /**
   * Extracts import statements from an AST
   * @param sourceFile - TypeScript source file AST
   * @param filePath - Path of the file being parsed
   * @returns ImportStatement[] - Array of import statements
   */
  extractImports(sourceFile: ts.SourceFile, filePath: string): ImportStatement[] {
    const imports: ImportStatement[] = [];

    const visit = (node: ts.Node) => {
      // Handle import declarations: import { x } from 'module'
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        
        if (ts.isStringLiteral(moduleSpecifier)) {
          const source = moduleSpecifier.text;
          const specifiers: string[] = [];
          let importKind: ImportStatement['importKind'] = 'named';

          // Extract imported names
          if (!node.importClause) {
            // Side-effect import: import 'module'
            importKind = 'side-effect';
          } else {
            // Default import: import X from 'module'
            if (node.importClause.name) {
              specifiers.push(node.importClause.name.text);
              importKind = 'default';
            }

            if (node.importClause.namedBindings) {
              // Namespace import: import * as X from 'module'
              if (ts.isNamespaceImport(node.importClause.namedBindings)) {
                specifiers.push(node.importClause.namedBindings.name.text);
                importKind = 'namespace';
              }
              // Named imports: import { a, b } from 'module'
              else if (ts.isNamedImports(node.importClause.namedBindings)) {
                node.importClause.namedBindings.elements.forEach((element) => {
                  specifiers.push(element.name.text);
                });
                // If there's also a default import, named takes precedence
                importKind = 'named';
              }
            }
          }

          const isExternal = this.isExternalModule(source);
          const resolvedSource = isExternal 
            ? source 
            : this.resolveRelativeImport(source, filePath);

          imports.push({
            source: resolvedSource,
            specifiers,
            isExternal,
            importKind,
          });
        }
      }

      // Handle call expressions: require() and dynamic import()
      if (ts.isCallExpression(node)) {
        // Handle require calls: const x = require('module')
        if (node.expression.kind === ts.SyntaxKind.Identifier) {
          const identifier = node.expression as ts.Identifier;
          if (identifier.text === 'require' && node.arguments.length > 0) {
            const arg = node.arguments[0];
            if (ts.isStringLiteral(arg)) {
              const source = arg.text;
              const isExternal = this.isExternalModule(source);
              const resolvedSource = isExternal 
                ? source 
                : this.resolveRelativeImport(source, filePath);

              imports.push({
                source: resolvedSource,
                specifiers: [],
                isExternal,
                importKind: 'require',
              });
            }
          }
        }

        // Handle dynamic imports: import('module') or await import('./module')
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length > 0) {
          const arg = node.arguments[0];
          if (ts.isStringLiteral(arg)) {
            const source = arg.text;
            const isExternal = this.isExternalModule(source);
            const resolvedSource = isExternal 
              ? source 
              : this.resolveRelativeImport(source, filePath);

            imports.push({
              source: resolvedSource,
              specifiers: [],
              isExternal,
              importKind: 'dynamic',
            });
          }
        }
      }

      // Handle re-exports with source: export { x } from 'module' and export * from 'module'
      if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const source = node.moduleSpecifier.text;
        const specifiers: string[] = [];
        let importKind: ImportStatement['importKind'];

        if (!node.exportClause) {
          // export * from 'module' or export * as ns from 'module'
          importKind = 'namespace';
        } else if (ts.isNamespaceExport(node.exportClause)) {
          // export * as ns from 'module'
          specifiers.push(node.exportClause.name.text);
          importKind = 'namespace';
        } else if (ts.isNamedExports(node.exportClause)) {
          // export { x, y } from 'module'
          node.exportClause.elements.forEach((element) => {
            specifiers.push(element.name.text);
          });
          importKind = 'named';
        } else {
          importKind = 'named';
        }

        const isExternal = this.isExternalModule(source);
        const resolvedSource = isExternal 
          ? source 
          : this.resolveRelativeImport(source, filePath);

        imports.push({
          source: resolvedSource,
          specifiers,
          isExternal,
          importKind,
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return imports;
  }

  /**
   * Extracts export statements from an AST
   * @param sourceFile - TypeScript source file AST
   * @returns ExportStatement[] - Array of export statements
   */
  extractExports(sourceFile: ts.SourceFile): ExportStatement[] {
    const exports: ExportStatement[] = [];

    const visit = (node: ts.Node) => {
      // Export declarations: export { x, y }
      if (ts.isExportDeclaration(node)) {
        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          node.exportClause.elements.forEach((element) => {
            exports.push({
              name: element.name.text,
              type: 'variable',
              isDefault: false,
            });
          });
        }
      }

      // Export assignments: export = something (CommonJS)
      if (ts.isExportAssignment(node)) {
        exports.push({
          name: 'default',
          type: 'default',
          isDefault: true,
        });
      }

      // Check for export modifiers on declarations
      const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
      const hasExportModifier = modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword
      );
      const hasDefaultModifier = modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.DefaultKeyword
      );

      if (hasExportModifier) {
        // Export function declaration: export function foo() {}
        if (ts.isFunctionDeclaration(node) && node.name) {
          exports.push({
            name: node.name.text,
            type: 'function',
            isDefault: hasDefaultModifier || false,
          });
        }

        // Export class declaration: export class Foo {}
        if (ts.isClassDeclaration(node) && node.name) {
          exports.push({
            name: node.name.text,
            type: 'class',
            isDefault: hasDefaultModifier || false,
          });
        }

        // Export variable statement: export const x = 1
        if (ts.isVariableStatement(node)) {
          node.declarationList.declarations.forEach((declaration) => {
            if (ts.isIdentifier(declaration.name)) {
              exports.push({
                name: declaration.name.text,
                type: 'variable',
                isDefault: hasDefaultModifier || false,
              });
            }
          });
        }

        // Export type/interface: export type X = ..., export interface Y {}
        if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
          exports.push({
            name: node.name.text,
            type: 'type',
            isDefault: hasDefaultModifier || false,
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return exports;
  }

  /**
   * Detects external API calls in the code (fetch, axios, database clients, etc.)
   * @param sourceFile - TypeScript source file AST
   * @returns ExternalCall[] - Array of external calls
   */
  private detectExternalCalls(sourceFile: ts.SourceFile): ExternalCall[] {
    const calls: ExternalCall[] = [];

    // Track database-related import names (e.g. prisma, mongoose, pg)
    const dbIdentifiers = new Set<string>();

    // First pass: collect database client identifiers from imports
    const collectDbImports = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        if (ts.isStringLiteral(moduleSpecifier)) {
          const source = moduleSpecifier.text;
          const dbPackages = ['@prisma/client', 'mongoose', 'pg', 'mysql', 'mysql2', 'sqlite3', 'better-sqlite3', 'typeorm', 'sequelize', 'knex', 'mongodb'];
          if (dbPackages.some(pkg => source === pkg || source.startsWith(pkg + '/'))) {
            if (node.importClause) {
              if (node.importClause.name) {
                dbIdentifiers.add(node.importClause.name.text);
              }
              if (node.importClause.namedBindings) {
                if (ts.isNamespaceImport(node.importClause.namedBindings)) {
                  dbIdentifiers.add(node.importClause.namedBindings.name.text);
                } else if (ts.isNamedImports(node.importClause.namedBindings)) {
                  node.importClause.namedBindings.elements.forEach(el => {
                    dbIdentifiers.add(el.name.text);
                  });
                }
              }
            }
          }
        }
      }
      ts.forEachChild(node, collectDbImports);
    };
    collectDbImports(sourceFile);

    const getLocation = (node: ts.Node): SourceLocation => {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      return { line: line + 1, column: character };
    };

    const getStringArg = (args: ts.NodeArray<ts.Expression>): string => {
      if (args.length > 0 && ts.isStringLiteral(args[0])) {
        return args[0].text;
      }
      return '';
    };

    const visit = (node: ts.Node) => {
      // Detect: new PrismaClient(), new MongoClient(), etc.
      if (ts.isNewExpression(node)) {
        const expr = node.expression;
        const name = ts.isIdentifier(expr) ? expr.text : '';
        const dbConstructors: Record<string, string> = {
          PrismaClient: 'prisma',
          MongoClient: 'mongodb',
          Mongoose: 'mongoose',
          Pool: 'pg',
          Client: 'pg',
          Sequelize: 'sequelize',
          DataSource: 'typeorm',
        };
        if (name in dbConstructors) {
          calls.push({ type: 'database', target: dbConstructors[name], location: getLocation(node) });
        }
      }

      if (ts.isCallExpression(node)) {
        const expr = node.expression;

        // Detect: fetch('url', ...)
        if (ts.isIdentifier(expr) && expr.text === 'fetch') {
          const target = getStringArg(node.arguments);
          calls.push({ type: 'fetch', target, location: getLocation(node) });
        }

        // Detect: axios('url'), axios.get/post/put/delete/patch/request('url')
        if (ts.isIdentifier(expr) && expr.text === 'axios') {
          const target = getStringArg(node.arguments);
          calls.push({ type: 'axios', target, location: getLocation(node) });
        }

        if (ts.isPropertyAccessExpression(expr)) {
          const obj = expr.expression;
          const method = expr.name.text;

          // axios.get/post/put/delete/patch/head/options/request
          if (ts.isIdentifier(obj) && obj.text === 'axios') {
            const axiosMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'request', 'create'];
            if (axiosMethods.includes(method)) {
              const target = getStringArg(node.arguments);
              calls.push({ type: 'axios', target, location: getLocation(node) });
            }
          }

          // Detect database client method calls: prisma.user.findMany(), mongoose.connect(), etc.
          if (ts.isIdentifier(obj) && dbIdentifiers.has(obj.text)) {
            calls.push({ type: 'database', target: obj.text, location: getLocation(node) });
          }

          // Detect prisma.* (common variable name even without explicit import tracking)
          if (ts.isIdentifier(obj) && (obj.text === 'prisma' || obj.text === 'db')) {
            // Only add if not already captured via dbIdentifiers
            if (!dbIdentifiers.has(obj.text)) {
              calls.push({ type: 'database', target: obj.text, location: getLocation(node) });
            }
          }

          // Detect mongoose.connect(), mongoose.model(), etc.
          if (ts.isIdentifier(obj) && obj.text === 'mongoose') {
            if (!dbIdentifiers.has('mongoose')) {
              calls.push({ type: 'database', target: 'mongoose', location: getLocation(node) });
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return calls;
  }

  /**
   * Extracts metadata about the module
   * @param sourceFile - TypeScript source file AST
   * @param exports - Extracted exports
   * @param filePath - Path of the file being parsed
   * @returns ModuleMetadata - Module metadata
   */
  private extractMetadata(
    sourceFile: ts.SourceFile,
    exports: ExportStatement[],
    filePath: string
  ): ModuleMetadata {
    const hasDefaultExport = exports.some((exp) => exp.isDefault);
    
    // Check if it's a React component (has JSX and exports a component)
    let isReactComponent = false;
    const hasJSX = this.hasJSXElements(sourceFile);
    const hasComponentExport = exports.some(
      (exp) => exp.type === 'function' || exp.type === 'class'
    );
    isReactComponent = hasJSX && hasComponentExport;

    // Check if it's an API route (common patterns in Next.js)
    const normalizedPath = filePath.replace(/\\/g, '/');
    const isApiRoute = normalizedPath.includes('/api/');

    return {
      hasDefaultExport,
      isReactComponent,
      isApiRoute,
    };
  }

  /**
   * Checks if the source file contains JSX elements
   * @param sourceFile - TypeScript source file AST
   * @returns boolean - True if JSX elements are found
   */
  private hasJSXElements(sourceFile: ts.SourceFile): boolean {
    let hasJSX = false;

    const visit = (node: ts.Node) => {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        hasJSX = true;
        return;
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return hasJSX;
  }

  /**
   * Determines if a module is external (from node_modules)
   * @param source - Import source string
   * @returns boolean - True if external module
   */
  private isExternalModule(source: string): boolean {
    // External modules don't start with './' or '../' or '/' or '@/'
    // '@/' is a common TypeScript path alias for internal modules
    return !source.startsWith('.') && !source.startsWith('/') && !source.startsWith('@/');
  }

  /**
   * Resolves a relative import to an absolute path
   * @param source - Relative import path
   * @param currentFilePath - Path of the file containing the import
   * @returns string - Resolved absolute path
   */
  private resolveRelativeImport(source: string, currentFilePath: string): string {
    // Handle TypeScript path alias '@/' which maps to project root
    if (source.startsWith('@/')) {
      // Remove '@/' and resolve from project root
      const relativePath = source.substring(2);
      
      // Don't append extension if already present
      if (relativePath.match(/\.(ts|tsx|js|jsx)$/)) {
        return relativePath;
      }
      
      return relativePath + '.ts';
    }
    
    const currentDir = path.dirname(currentFilePath);
    const resolved = path.join(currentDir, source);
    const normalized = resolved.replace(/\\/g, '/');
    
    // Don't append extension if already present
    if (normalized.match(/\.(ts|tsx|js|jsx)$/)) {
      return normalized;
    }
    
    return normalized + '.ts';
  }
}
