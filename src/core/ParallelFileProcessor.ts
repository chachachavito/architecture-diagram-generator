import { ASTParser, ParsedModule } from '../parsers';
import { ModuleCache } from './ModuleCache';

/**
 * Configuration for parallel file processing
 */
export interface ParallelProcessingOptions {
  concurrency?: number;  // Number of concurrent parsing operations (default: 4)
  cache?: ModuleCache;   // Optional cache for parsed modules
}

/**
 * Result of parallel file processing
 */
export interface ProcessingResult {
  successful: ParsedModule[];
  failed: Array<{ file: string; error: string }>;
  duration: number;
}

/**
 * ParallelFileProcessor handles concurrent parsing of multiple files
 * Uses Promise.all with concurrency control to optimize performance
 */
export class ParallelFileProcessor {
  private parser: ASTParser;
  private concurrency: number;
  private cache?: ModuleCache;

  constructor(rootDir: string, options: ParallelProcessingOptions = {}) {
    this.parser = new ASTParser(rootDir, options.cache);
    this.concurrency = options.concurrency || 4;
    this.cache = options.cache;
  }

  /**
   * Process multiple files in parallel with concurrency control
   * @param files - Array of file paths to process
   * @returns Promise<ProcessingResult> - Results of processing
   */
  async processFiles(files: string[]): Promise<ProcessingResult> {
    const startTime = Date.now();
    const successful: ParsedModule[] = [];
    const failed: Array<{ file: string; error: string }> = [];

    // Process files in batches to control concurrency
    for (let i = 0; i < files.length; i += this.concurrency) {
      const batch = files.slice(i, i + this.concurrency);
      const batchPromises = batch.map(file =>
        this.parser.parse(file)
          .then(module => ({ success: true as const, module }))
          .catch(error => ({
            success: false as const,
            file,
            error: error instanceof Error ? error.message : String(error),
          }))
      );

      const results = await Promise.all(batchPromises);

      for (const result of results) {
        if (result.success) {
          successful.push(result.module);
        } else {
          failed.push({
            file: result.file,
            error: result.error,
          });
        }
      }
    }

    const duration = Date.now() - startTime;

    return {
      successful,
      failed,
      duration,
    };
  }

  /**
   * Get cache statistics if cache is enabled
   */
  getCacheStats() {
    return this.cache?.getStats();
  }

  /**
   * Reset cache statistics
   */
  resetCacheStats(): void {
    this.cache?.resetStats();
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache?.clear();
  }
}
