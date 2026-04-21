import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { ParsedModule } from '../parsers';

/**
 * Interface for cache entry metadata
 */
export interface CacheEntry {
  hash: string;
  timestamp: number;
  module: ParsedModule;
  version?: string; // Version of the tool that generated this entry
}

/**
 * Interface for cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  invalidations: number;
}

/**
 * ModuleCache provides caching for parsed AST modules with file change detection
 * Invalidates cache entries when source files are modified
 */
export class ModuleCache {
  private cache: Map<string, CacheEntry> = new Map();
  private fileHashes: Map<string, string> = new Map();
  private stats: CacheStats = { hits: 0, misses: 0, invalidations: 0 };
  private cacheDir: string;
  private enabled: boolean;
  private readonly CURRENT_VERSION = '0.3.0'; // Invalidate cache for new engine

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || path.join(process.cwd(), '.cache', 'ast-parser');
    this.enabled = !!cacheDir; // Only enable persistent cache if directory is provided
  }

  /**
   * Get a cached module if it exists and is still valid
   * @param filePath - Absolute path to the file
   * @returns Cached ParsedModule or null if not found or invalid
   */
  async get(filePath: string): Promise<ParsedModule | null> {
    // Check in-memory cache first
    const entry = this.cache.get(filePath);
    if (entry) {
      const currentHash = await this.getFileHash(filePath);
      if (currentHash === entry.hash && entry.version === this.CURRENT_VERSION) {
        this.stats.hits++;
        return entry.module;
      } else {
        // File has changed, invalidate cache entry
        this.cache.delete(filePath);
        this.fileHashes.delete(filePath);
        this.stats.invalidations++;
        // Also remove from persistent cache
        if (this.enabled) {
          await this.removeFromDisk(filePath);
        }
        return null;
      }
    }

    // Check persistent cache if enabled
    if (this.enabled) {
      const persistedEntry = await this.loadFromDisk(filePath);
      if (persistedEntry) {
        const currentHash = await this.getFileHash(filePath);
        if (currentHash === persistedEntry.hash && persistedEntry.version === this.CURRENT_VERSION) {
          // Restore to in-memory cache
          this.cache.set(filePath, persistedEntry);
          this.fileHashes.set(filePath, persistedEntry.hash);
          this.stats.hits++;
          return persistedEntry.module;
        } else {
          // File has changed, remove stale cache
          await this.removeFromDisk(filePath);
          this.stats.invalidations++;
          return null;
        }
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Store a parsed module in cache
   * @param filePath - Absolute path to the file
   * @param module - Parsed module to cache
   */
  async set(filePath: string, module: ParsedModule): Promise<void> {
    const hash = await this.getFileHash(filePath);
    const entry: CacheEntry = {
      hash,
      timestamp: Date.now(),
      module,
      version: this.CURRENT_VERSION,
    };

    // Store in in-memory cache
    this.cache.set(filePath, entry);
    this.fileHashes.set(filePath, hash);

    // Store in persistent cache if enabled
    if (this.enabled) {
      await this.saveToDisk(filePath, entry);
    }
  }

  /**
   * Clear all cache entries (both in-memory and persistent)
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.fileHashes.clear();

    // Clear persistent cache if enabled
    if (this.enabled) {
      try {
        await fs.rm(this.cacheDir, { recursive: true, force: true });
        await fs.mkdir(this.cacheDir, { recursive: true });
      } catch {
        // Silently fail if we can't clear disk cache
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, invalidations: 0 };
  }

  /**
   * Compute hash of file contents
   * @param filePath - Path to the file
   * @returns SHA256 hash of file contents
   */
  private async getFileHash(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch {
      // If file can't be read, return empty hash
      return '';
    }
  }

  /**
   * Save cache entry to disk
   * @param filePath - Path to the source file
   * @param entry - Cache entry to save
   */
  private async saveToDisk(filePath: string, entry: CacheEntry): Promise<void> {
    try {
      // Create cache directory if it doesn't exist
      await fs.mkdir(this.cacheDir, { recursive: true });

      // Create a safe filename from the file path
      const cacheKey = this.getCacheKey(filePath);
      const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);

      // Write cache entry as JSON
      await fs.writeFile(cachePath, JSON.stringify(entry, null, 2), 'utf-8');
    } catch {
      // Silently fail if we can't write to disk
      // This allows the cache to work in read-only environments
    }
  }

  /**
   * Load cache entry from disk
   * @param filePath - Path to the source file
   * @returns Cache entry or null if not found
   */
  private async loadFromDisk(filePath: string): Promise<CacheEntry | null> {
    try {
      const cacheKey = this.getCacheKey(filePath);
      const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);

      const content = await fs.readFile(cachePath, 'utf-8');
      return JSON.parse(content) as CacheEntry;
    } catch {
      // Return null if cache file doesn't exist or can't be read
      return null;
    }
  }

  /**
   * Remove cache entry from disk
   * @param filePath - Path to the source file
   */
  private async removeFromDisk(filePath: string): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(filePath);
      const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);
      await fs.unlink(cachePath);
    } catch {
      // Silently fail if we can't remove the file
    }
  }

  /**
   * Generate a safe cache key from file path
   * @param filePath - Path to the source file
   * @returns Safe cache key
   */
  private getCacheKey(filePath: string): string {
    // Use hash of the absolute path as cache key
    return crypto.createHash('sha256').update(filePath).digest('hex');
  }
}
