import * as ts from 'typescript';
import { Project, SourceFile, SyntaxKind } from 'ts-morph';
import * as path from 'path';
import { ModuleCache } from '../core/ModuleCache';
import { ParseError } from '../utils/errors';

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
  private static project: Project | null = null;

  constructor(rootDir: string, cache?: ModuleCache) {
    this.rootDir = rootDir;
    this.cache = cache;
  }

  /**
   * Gets or initializes the ts-morph project singleton
   */
  private getProject(): Project {
    if (!ASTParser.project) {
      const tsConfigPath = path.join(this.rootDir, 'tsconfig.json');
      
      // Check if tsconfig exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const projectOptions: any = {
        skipAddingFilesFromTsConfig: true,
      };

      try {
        // We use a sync-like check or just provide the path and let ts-morph handle it if it exists
        // But ts-morph throws if tsConfigFilePath is provided but not found.
        // So we should only provide it if it exists.
        // Using a simple flag to check existence.
        projectOptions.tsConfigFilePath = tsConfigPath;
        ASTParser.project = new Project(projectOptions);
      } catch {
        // Fallback to default project without tsconfig
        ASTParser.project = new Project({
          compilerOptions: {
            allowJs: true,
            target: ts.ScriptTarget.ESNext,
            module: ts.ModuleKind.CommonJS,
          }
        });
      }
    }
    return ASTParser.project;
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

    // 1. Validate extension
    const ext = path.extname(absolutePath).toLowerCase();
    const validExtensions = ['.ts', '.tsx', '.js', '.jsx'];
    if (!validExtensions.includes(ext)) {
      throw new ParseError(filePath, `Invalid file extension: ${ext}`);
    }

    // 2. Check cache first
    if (this.cache) {
      const cached = await this.cache.get(absolutePath);
      if (cached) {
        return cached;
      }
    }

    // Get source file from ts-morph project
    const project = this.getProject();
    let sourceFile = project.getSourceFile(absolutePath);
    
    if (!sourceFile) {
      sourceFile = project.addSourceFileAtPath(absolutePath);
    }

    // Refresh from disk to ensure we have the latest content if it changed
    await sourceFile.refreshFromFileSystem();

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

  extractImports(sourceFile: SourceFile, filePath: string): ImportStatement[] {
    const imports: ImportStatement[] = [];

    // 1. Standard imports
    sourceFile.getImportDeclarations().forEach(importDecl => {
      const source = importDecl.getModuleSpecifierValue();
      const isTypeOnly = importDecl.isTypeOnly();
      const specifiers: string[] = [];
      let importKind: ImportStatement['importKind'] = 'named';

      const defaultImport = importDecl.getDefaultImport();
      if (defaultImport) {
        specifiers.push(defaultImport.getText());
        importKind = 'default';
      }

      const namespaceImport = importDecl.getNamespaceImport();
      if (namespaceImport) {
        specifiers.push(namespaceImport.getText());
        importKind = 'namespace';
      }

      importDecl.getNamedImports().forEach(named => {
        specifiers.push(named.getName());
        importKind = 'named';
      });

      if (specifiers.length === 0 && !defaultImport && !namespaceImport) {
        importKind = 'side-effect';
      }

      const isExternal = this.isExternalModule(source);
      const resolvedSource = isExternal 
        ? source 
        : this.resolveRelativeImport(source, filePath);

      imports.push({
        source: resolvedSource,
        specifiers,
        isExternal,
        isTypeOnly,
        importKind,
      });
    });

    // 2. Dynamic imports and require calls
    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(call => {
      const expression = call.getExpression();
      
      // Dynamic import()
      if (expression.getKind() === SyntaxKind.ImportKeyword) {
        const args = call.getArguments();
        if (args.length > 0 && args[0].getKind() === SyntaxKind.StringLiteral) {
          const source = args[0].asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue();
          const isExternal = this.isExternalModule(source);
          const resolvedSource = isExternal ? source : this.resolveRelativeImport(source, filePath);
          
          imports.push({
            source: resolvedSource,
            specifiers: [],
            isExternal,
            isTypeOnly: false, // Dynamic imports are runtime
            importKind: 'dynamic',
          });
        }
      }

      // require()
      if (expression.getKind() === SyntaxKind.Identifier && expression.getText() === 'require') {
        const args = call.getArguments();
        if (args.length > 0 && args[0].getKind() === SyntaxKind.StringLiteral) {
          const source = args[0].asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue();
          const isExternal = this.isExternalModule(source);
          const resolvedSource = isExternal ? source : this.resolveRelativeImport(source, filePath);

          imports.push({
            source: resolvedSource,
            specifiers: [],
            isExternal,
            isTypeOnly: false,
            importKind: 'require',
          });
        }
      }
    });

    // 3. Re-exports with source
    sourceFile.getExportDeclarations().forEach(exportDecl => {
      const moduleSpecifier = exportDecl.getModuleSpecifierValue();
      if (moduleSpecifier) {
        const source = moduleSpecifier;
        const specifiers: string[] = [];
        let importKind: ImportStatement['importKind'] = 'named';

        if (exportDecl.isNamespaceExport()) {
          importKind = 'namespace';
          const name = exportDecl.getNamespaceExport()?.getName();
          if (name) specifiers.push(name);
        } else {
          exportDecl.getNamedExports().forEach(named => {
            specifiers.push(named.getName());
          });
          importKind = 'named';
        }

        const isExternal = this.isExternalModule(source);
        const resolvedSource = isExternal ? source : this.resolveRelativeImport(source, filePath);

        imports.push({
          source: resolvedSource,
          specifiers,
          isExternal,
          isTypeOnly: exportDecl.isTypeOnly(),
          importKind,
        });
      }
    });

    return imports;
  }

  extractExports(sourceFile: SourceFile): ExportStatement[] {
    const exports: ExportStatement[] = [];

    // Named exports: export { x, y }
    sourceFile.getExportDeclarations().forEach(exportDecl => {
      exportDecl.getNamedExports().forEach(named => {
        exports.push({
          name: named.getName(),
          type: 'variable',
          isDefault: false,
        });
      });
    });

    // Default exports and assignments
    sourceFile.getExportAssignments().forEach(_assign => {
      exports.push({
        name: 'default',
        type: 'default',
        isDefault: true,
      });
    });

    // Declarations with export modifier
    sourceFile.getFunctions().filter(f => f.isExported()).forEach(f => {
      exports.push({
        name: f.getName() || 'default',
        type: 'function',
        isDefault: f.isDefaultExport(),
      });
    });

    sourceFile.getClasses().filter(c => c.isExported()).forEach(c => {
      exports.push({
        name: c.getName() || 'default',
        type: 'class',
        isDefault: c.isDefaultExport(),
      });
    });

    sourceFile.getVariableStatements().filter(v => v.isExported()).forEach(v => {
      v.getDeclarations().forEach(decl => {
        exports.push({
          name: decl.getName(),
          type: 'variable',
          isDefault: false,
        });
      });
    });

    sourceFile.getInterfaces().filter(i => i.isExported()).forEach(i => {
      exports.push({
        name: i.getName(),
        type: 'type',
        isDefault: i.isDefaultExport(),
      });
    });

    sourceFile.getTypeAliases().filter(t => t.isExported()).forEach(t => {
      exports.push({
        name: t.getName(),
        type: 'type',
        isDefault: t.isDefaultExport(),
      });
    });

    return exports;
  }

  private detectExternalCalls(sourceFile: SourceFile): ExternalCall[] {
    const calls: ExternalCall[] = [];
    const typeChecker = this.getProject().getTypeChecker();

    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(call => {
      const expression = call.getExpression();
      const text = expression.getText();
      const { line, column } = sourceFile.getLineAndColumnAtPos(call.getStart());

      let detected = false;

      // 1. fetch('url')
      if (text === 'fetch') {
        const args = call.getArguments();
        let target = args.length > 0 && args[0].getKind() === SyntaxKind.StringLiteral 
          ? args[0].asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue() 
          : '';
        
        // Safety: Limit target length and ensure it doesn't look like HTML
        if (target.length > 100) target = target.substring(0, 97) + '...';
        
        // Don't push if it looks like HTML, but allow empty targets (for variables)
        if (!target.includes('<')) {
          calls.push({ type: 'fetch', target, location: { line, column } });
          detected = true;
        }
      }

      // 2. axios.get('url') or axios('url')
      if (!detected && (text === 'axios' || text.startsWith('axios.'))) {
        const args = call.getArguments();
        let target = args.length > 0 && args[0].getKind() === SyntaxKind.StringLiteral 
          ? args[0].asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue() 
          : '';
        
        // Safety: Limit target length
        if (target.length > 100) target = target.substring(0, 97) + '...';

        if (!target.includes('<')) {
          calls.push({ type: 'axios', target, location: { line, column } });
          detected = true;
        }
      }

      // 3. Database detection (Type-based + Heuristics)
      if (!detected) {
        try {
          const type = typeChecker.getTypeAtLocation(expression);
          const typeText = type.getText();
          
          const dbPatterns = ['PrismaClient', 'MongoClient', 'Mongoose', 'Sequelize', 'Knex', 'Pool'];
          if (dbPatterns.some(p => typeText.includes(p))) {
            calls.push({ type: 'database', target: typeText, location: { line, column } });
            detected = true;
          }
        } catch {
          // Type checking failed, fall back to name-based detection
        }

        // Fallback: Name-based heuristics for DB (essential for tests without node_modules)
        if (!detected) {
          const dbNames = ['prisma', 'db', 'database', 'repo', 'repository', 'knex', 'sequelize', 'mongoose', 'mongodb'];
          const lowerText = text.toLowerCase();
          if (dbNames.some(name => lowerText.includes(name))) {
            const target = text.split('.')[0];
            // Safety: Ensure target is not HTML and not too long
            if (target && !target.includes('<') && target.length < 100) {
              calls.push({ type: 'database', target, location: { line, column } });
            }
          }
        }
      }
    });

    // Detect 'new' expressions for DB clients
    sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).forEach(newExpr => {
      let detected = false;
      const dbPatterns = ['PrismaClient', 'MongoClient', 'Mongoose', 'Sequelize', 'DataSource', 'Pool'];
      
      try {
        const type = typeChecker.getTypeAtLocation(newExpr);
        const typeText = type.getText();
        const { line } = sourceFile.getLineAndColumnAtPos(newExpr.getStart());
        
        if (dbPatterns.some(p => typeText.includes(p))) {
          let target = typeText;
          if (target.includes('Sequelize')) target = 'sequelize';
          if (target.includes('PrismaClient')) target = 'prisma';
          if (target.includes('MongoClient')) target = 'mongodb';
          
          // Validation: Ensure target is not malformed HTML and within length
          if (!target.includes('<') && target.length < 100) {
            calls.push({ type: 'database', target, location: { line, column: 0 } });
            detected = true;
          }
        }
      } catch {
        // Type checking failed, fall back to name-based detection
      }

      if (!detected) {
        const text = newExpr.getExpression().getText();
        if (dbPatterns.some(p => text.includes(p))) {
          const { line } = sourceFile.getLineAndColumnAtPos(newExpr.getStart());
          let target = text;
          if (target === 'Sequelize') target = 'sequelize';
          if (target === 'PrismaClient') target = 'prisma';
          if (target === 'MongoClient') target = 'mongodb';
          
          if (!target.includes('<') && target.length < 100) {
            calls.push({ type: 'database', target, location: { line, column: 0 } });
          }
        }
      }
    });

    return calls;
  }

  private extractMetadata(
    sourceFile: SourceFile,
    exports: ExportStatement[],
    filePath: string
  ): ModuleMetadata {
    const hasDefaultExport = exports.some((exp) => exp.isDefault);
    
    // Check if it's a React component (has JSX and exports a component)
    let isReactComponent = false;
    const hasJSX = sourceFile.getDescendantsOfKind(SyntaxKind.JsxElement).length > 0 || 
                   sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).length > 0;
    
    const hasComponentExport = exports.some(
      (exp) => exp.type === 'function' || exp.type === 'class'
    );
    isReactComponent = hasJSX && hasComponentExport;

    // Check if it's an API route (common patterns in Next.js)
    const normalizedPath = filePath.replace(/\\/g, '/');
    const isApiRoute = normalizedPath.includes('/api/');

    // Phase 3: New metadata
    const inheritance = this.extractInheritance(sourceFile);
    const decorators = this.extractDecorators(sourceFile);
    const metrics = this.calculateMetrics(sourceFile);

    return {
      hasDefaultExport,
      isReactComponent,
      isApiRoute,
      inheritance,
      decorators,
      metrics
    };
  }

  private extractInheritance(sourceFile: SourceFile): InheritanceInfo[] {
    const inheritance: InheritanceInfo[] = [];

    sourceFile.getClasses().forEach(cls => {
      const extendsExpr = cls.getExtends();
      if (extendsExpr) {
        inheritance.push({
          name: extendsExpr.getText(),
          type: 'extends'
        });
      }

      cls.getImplements().forEach(imp => {
        inheritance.push({
          name: imp.getText(),
          type: 'implements'
        });
      });
    });

    return inheritance;
  }

  private extractDecorators(sourceFile: SourceFile): string[] {
    const decorators = new Set<string>();

    sourceFile.getDescendantsOfKind(SyntaxKind.Decorator).forEach(dec => {
      const text = dec.getName();
      if (text) decorators.add(text);
    });

    return Array.from(decorators);
  }

  private calculateMetrics(sourceFile: SourceFile): ModuleMetrics {
    // 1. SLOC (excluding empty lines and simple comments if possible)
    const text = sourceFile.getFullText();
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const sloc = lines.length;

    // 2. Cyclomatic Complexity (Basic decision point counting)
    let complexity = 1; // Base complexity
    const decisionPoints = [
      SyntaxKind.IfStatement,
      SyntaxKind.ForStatement,
      SyntaxKind.ForInStatement,
      SyntaxKind.ForOfStatement,
      SyntaxKind.WhileStatement,
      SyntaxKind.DoStatement,
      SyntaxKind.CaseClause,
      SyntaxKind.ConditionalExpression, // ternary
      SyntaxKind.BinaryExpression // logic operators (&&, ||)
    ];

    sourceFile.getDescendants().forEach(node => {
      const kind = node.getKind();
      if (decisionPoints.includes(kind)) {
        if (kind === SyntaxKind.BinaryExpression) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const operator = (node as any).getOperatorToken().getKind();
          if (operator === SyntaxKind.AmpersandAmpersandToken || operator === SyntaxKind.BarBarToken) {
            complexity++;
          }
        } else {
          complexity++;
        }
      }
    });

    return { sloc, complexity };
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
