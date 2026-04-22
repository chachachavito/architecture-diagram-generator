/**
 * Logging system for the Architecture Diagram Generator
 * Provides progress tracking, statistics, and formatted output
 */

/**
 * Log level enumeration
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Statistics tracked during generation
 */
export interface GenerationStats {
  filesDiscovered: number;
  filesParsed: number;
  parseErrors: number;
  nodesCreated: number;
  edgesCreated: number;
  externalServicesDetected: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

/**
 * Logger class for tracking progress and statistics
 */
export class Logger {
  private logLevel: LogLevel = LogLevel.INFO;
  private stats: GenerationStats = {
    filesDiscovered: 0,
    filesParsed: 0,
    parseErrors: 0,
    nodesCreated: 0,
    edgesCreated: 0,
    externalServicesDetected: 0,
    startTime: new Date(),
  };
  private startTime: number = Date.now();

  constructor(logLevel: LogLevel = LogLevel.INFO) {
    this.logLevel = logLevel;
  }

  /**
   * Log a debug message
   */
  debug(message: string, data?: unknown): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.log(`🔍 DEBUG: ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  /**
   * Log an info message
   */
  info(message: string): void {
    if (this.logLevel <= LogLevel.INFO) {
      console.log(`ℹ️  ${message}`);
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string): void {
    if (this.logLevel <= LogLevel.WARN) {
      console.warn(`⚠️  ${message}`);
    }
  }

  /**
   * Log an error message
   */
  error(message: string): void {
    if (this.logLevel <= LogLevel.ERROR) {
      console.error(`❌ ${message}`);
    }
  }

  /**
   * Log a success message
   */
  success(message: string): void {
    console.log(`✅ ${message}`);
  }

  /**
   * Log a section header
   */
  section(title: string): void {
    console.log('');
    console.log(`📋 ${title}`);
    console.log('─'.repeat(title.length + 3));
  }

  /**
   * Log a subsection
   */
  subsection(title: string): void {
    console.log(`  └─ ${title}`);
  }

  /**
   * Log progress during file discovery
   */
  logDiscoveryProgress(
    routesCount: number,
    apiCount: number,
    componentsCount: number,
    utilitiesCount: number,
    configCount: number = 0
  ): void {
    this.stats.filesDiscovered = routesCount + apiCount + componentsCount + utilitiesCount + configCount;
    
    this.section('File Discovery');
    this.subsection(`Total files found: ${this.stats.filesDiscovered}`);
    this.subsection(`Routes: ${routesCount}`);
    this.subsection(`API endpoints: ${apiCount}`);
    this.subsection(`Components: ${componentsCount}`);
    this.subsection(`Utilities: ${utilitiesCount}`);
    if (configCount > 0) {
      this.subsection(`Config files: ${configCount}`);
    }
  }

  /**
   * Log parsing progress
   */
  logParsingProgress(
    parsedCount: number,
    errorCount: number,
    duration: number,
    cacheHits?: number,
    cacheMisses?: number
  ): void {
    this.stats.filesParsed = parsedCount;
    this.stats.parseErrors = errorCount;

    this.section('File Parsing');
    this.subsection(`Successfully parsed: ${parsedCount} files`);
    if (errorCount > 0) {
      this.subsection(`Parse errors: ${errorCount}`);
    }
    this.subsection(`Duration: ${duration}ms`);
    
    if (cacheHits !== undefined && cacheMisses !== undefined) {
      const total = cacheHits + cacheMisses;
      const hitRate = total > 0 ? ((cacheHits / total) * 100).toFixed(1) : '0.0';
      this.subsection(`Cache: ${cacheHits} hits, ${cacheMisses} misses (${hitRate}% hit rate)`);
    }
  }

  /**
   * Log graph building progress
   */
  logGraphProgress(
    nodeCount: number,
    edgeCount: number,
    externalServiceCount: number
  ): void {
    this.stats.nodesCreated = nodeCount;
    this.stats.edgesCreated = edgeCount;
    this.stats.externalServicesDetected = externalServiceCount;

    this.section('Dependency Graph');
    this.subsection(`Nodes created: ${nodeCount}`);
    this.subsection(`Edges created: ${edgeCount}`);
    if (externalServiceCount > 0) {
      this.subsection(`External services detected: ${externalServiceCount}`);
    }
  }

  /**
   * Log diagram generation progress
   */
  logDiagramProgress(mode: string, nodeCount: number, edgeCount: number): void {
    this.section('Diagram Generation');
    this.subsection(`Mode: ${mode}`);
    this.subsection(`Nodes in diagram: ${nodeCount}`);
    this.subsection(`Edges in diagram: ${edgeCount}`);
  }

  /**
   * Log output progress
   */
  logOutputProgress(outputPath: string): void {
    this.section('Output');
    this.subsection(`Saved to: ${outputPath}`);
  }

  /**
   * Log parse errors with details
   */
  logParseErrors(errors: Array<{ file: string; error: string }>): void {
    if (errors.length === 0) return;

    this.section('Parse Errors');
    for (const err of errors) {
      this.subsection(`${err.file}: ${err.error}`);
    }
  }

  /**
   * Log final summary statistics
   */
  logSummary(): void {
    this.stats.endTime = new Date();
    this.stats.duration = Date.now() - this.startTime;

    this.section('Summary');
    this.subsection(`Files discovered: ${this.stats.filesDiscovered}`);
    this.subsection(`Files parsed: ${this.stats.filesParsed}`);
    if (this.stats.parseErrors > 0) {
      this.subsection(`Parse errors: ${this.stats.parseErrors}`);
    }
    this.subsection(`Nodes created: ${this.stats.nodesCreated}`);
    this.subsection(`Edges created: ${this.stats.edgesCreated}`);
    if (this.stats.externalServicesDetected > 0) {
      this.subsection(`External services: ${this.stats.externalServicesDetected}`);
    }
    this.subsection(`Total duration: ${this.stats.duration}ms`);
    
    console.log('');
    this.success('Generation complete!');
  }

  /**
   * Get current statistics
   */
  getStats(): GenerationStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      filesDiscovered: 0,
      filesParsed: 0,
      parseErrors: 0,
      nodesCreated: 0,
      edgesCreated: 0,
      externalServicesDetected: 0,
      startTime: new Date(),
    };
    this.startTime = Date.now();
  }
}

/**
 * Global logger instance
 */
let globalLogger: Logger | null = null;

/**
 * Get or create the global logger instance
 */
export function getLogger(logLevel: LogLevel = LogLevel.INFO): Logger {
  if (!globalLogger) {
    globalLogger = new Logger(logLevel);
  }
  return globalLogger;
}

/**
 * Reset the global logger
 */
export function resetLogger(): void {
  globalLogger = null;
}
