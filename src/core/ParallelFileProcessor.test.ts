import { ParallelFileProcessor } from './ParallelFileProcessor';
import { ModuleCache } from './ModuleCache';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('ParallelFileProcessor', () => {
  let tempDir: string;
  let processor: ParallelFileProcessor;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'parallel-processor-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    if (tempDir && tempDir.startsWith(os.tmpdir())) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('processFiles()', () => {
    it('should process multiple files in parallel', async () => {
      // Create test files
      const files = ['file1.ts', 'file2.ts', 'file3.ts'];
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        await fs.writeFile(filePath, `export const ${file.replace('.ts', '')} = 1;`);
      }

      processor = new ParallelFileProcessor(tempDir);
      const result = await processor.processFiles(files);

      expect(result.successful.length).toBe(3);
      expect(result.failed.length).toBe(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle file processing errors gracefully', async () => {
      // Create one valid file and one invalid path
      const validFile = 'valid.ts';
      const invalidFile = 'non-existent.ts';

      const filePath = path.join(tempDir, validFile);
      await fs.writeFile(filePath, 'export const valid = 1;');

      processor = new ParallelFileProcessor(tempDir);
      const result = await processor.processFiles([validFile, invalidFile]);

      expect(result.successful.length).toBe(1);
      expect(result.failed.length).toBe(1);
      expect(result.failed[0].file).toBe(invalidFile);
      expect(result.failed[0].error).toBeDefined();
    });

    it('should respect concurrency limit', async () => {
      // Create multiple test files
      const fileCount = 10;
      const files: string[] = [];
      for (let i = 0; i < fileCount; i++) {
        const file = `file${i}.ts`;
        files.push(file);
        const filePath = path.join(tempDir, file);
        await fs.writeFile(filePath, `export const file${i} = ${i};`);
      }

      // Create processor with concurrency of 2
      processor = new ParallelFileProcessor(tempDir, { concurrency: 2 });
      const result = await processor.processFiles(files);

      expect(result.successful.length).toBe(fileCount);
      expect(result.failed.length).toBe(0);
    });

    it('should measure processing duration', async () => {
      // Create test files
      const files = ['file1.ts', 'file2.ts'];
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        await fs.writeFile(filePath, `export const ${file.replace('.ts', '')} = 1;`);
      }

      processor = new ParallelFileProcessor(tempDir);
      const result = await processor.processFiles(files);

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('cache integration', () => {
    it('should use cache when provided', async () => {
      // Create test file
      const file = 'cached.ts';
      const filePath = path.join(tempDir, file);
      await fs.writeFile(filePath, 'export const cached = 1;');

      const cache = new ModuleCache();
      processor = new ParallelFileProcessor(tempDir, { cache });

      // First processing - should miss cache
      let result = await processor.processFiles([file]);
      expect(result.successful.length).toBe(1);

      let stats = processor.getCacheStats();
      expect(stats?.misses).toBe(1);
      expect(stats?.hits).toBe(0);

      // Second processing - should hit cache
      result = await processor.processFiles([file]);
      expect(result.successful.length).toBe(1);

      stats = processor.getCacheStats();
      expect(stats?.hits).toBe(1);
    });

    it('should invalidate cache on file changes', async () => {
      // Create test file
      const file = 'changing.ts';
      const filePath = path.join(tempDir, file);
      await fs.writeFile(filePath, 'export const changing = 1;');

      const cache = new ModuleCache();
      processor = new ParallelFileProcessor(tempDir, { cache });

      // First processing
      let result = await processor.processFiles([file]);
      expect(result.successful.length).toBe(1);

      let stats = processor.getCacheStats();
      expect(stats?.misses).toBe(1);

      // Modify file
      await fs.writeFile(filePath, 'export const changing = 2;');

      // Second processing - cache should be invalidated
      result = await processor.processFiles([file]);
      expect(result.successful.length).toBe(1);

      stats = processor.getCacheStats();
      expect(stats?.invalidations).toBe(1);
    });
  });

  describe('getCacheStats()', () => {
    it('should return cache statistics when cache is enabled', async () => {
      const file = 'stats.ts';
      const filePath = path.join(tempDir, file);
      await fs.writeFile(filePath, 'export const stats = 1;');

      const cache = new ModuleCache();
      processor = new ParallelFileProcessor(tempDir, { cache });

      await processor.processFiles([file]);
      const stats = processor.getCacheStats();

      expect(stats).toBeDefined();
      expect(stats?.misses).toBe(1);
    });

    it('should return undefined when cache is not enabled', async () => {
      const file = 'no-cache.ts';
      const filePath = path.join(tempDir, file);
      await fs.writeFile(filePath, 'export const noCache = 1;');

      processor = new ParallelFileProcessor(tempDir);
      await processor.processFiles([file]);

      const stats = processor.getCacheStats();
      expect(stats).toBeUndefined();
    });
  });

  describe('resetCacheStats()', () => {
    it('should reset cache statistics', async () => {
      const file = 'reset.ts';
      const filePath = path.join(tempDir, file);
      await fs.writeFile(filePath, 'export const reset = 1;');

      const cache = new ModuleCache();
      processor = new ParallelFileProcessor(tempDir, { cache });

      await processor.processFiles([file]);
      let stats = processor.getCacheStats();
      expect(stats?.misses).toBe(1);

      processor.resetCacheStats();
      stats = processor.getCacheStats();
      expect(stats?.misses).toBe(0);
      expect(stats?.hits).toBe(0);
    });
  });

  describe('clearCache()', () => {
    it('should clear the cache', async () => {
      const file = 'clear.ts';
      const filePath = path.join(tempDir, file);
      await fs.writeFile(filePath, 'export const clear = 1;');

      const cache = new ModuleCache();
      processor = new ParallelFileProcessor(tempDir, { cache });

      // First processing - cache miss
      await processor.processFiles([file]);
      let stats = processor.getCacheStats();
      expect(stats?.misses).toBe(1);

      // Second processing - cache hit
      await processor.processFiles([file]);
      stats = processor.getCacheStats();
      expect(stats?.hits).toBe(1);

      // Clear cache
      processor.clearCache();

      // Third processing - cache miss again
      await processor.processFiles([file]);
      stats = processor.getCacheStats();
      expect(stats?.misses).toBe(2);
    });
  });
});
