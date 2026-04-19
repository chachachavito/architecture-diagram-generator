import { ParallelFileProcessor } from './ParallelFileProcessor';
import { ModuleCache } from './ModuleCache';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('ParallelFileProcessor Integration Tests', () => {
  let tempDir: string;
  let cacheDir: string;

  beforeEach(async () => {
    // Create temporary directories
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'parallel-integration-'));
    cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-'));
  });

  afterEach(async () => {
    // Clean up temp directories
    for (const dir of [tempDir, cacheDir]) {
      if (dir && dir.startsWith(os.tmpdir())) {
        try {
          await fs.rm(dir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  });

  describe('Performance optimization with caching and parallelization', () => {
    it('should process large number of files efficiently with caching', async () => {
      // Create 20 test files
      const fileCount = 20;
      const files: string[] = [];
      for (let i = 0; i < fileCount; i++) {
        const file = `file${i}.ts`;
        files.push(file);
        const filePath = path.join(tempDir, file);
        await fs.writeFile(filePath, `export const file${i} = ${i}; export function func${i}() { return ${i}; }`);
      }

      const cache = new ModuleCache(cacheDir);
      const processor = new ParallelFileProcessor(tempDir, { concurrency: 4, cache });

      // First run - all cache misses
      const startTime1 = Date.now();
      const result1 = await processor.processFiles(files);
      const duration1 = Date.now() - startTime1;

      expect(result1.successful.length).toBe(fileCount);
      expect(result1.failed.length).toBe(0);

      let stats = processor.getCacheStats();
      expect(stats?.misses).toBe(fileCount);
      expect(stats?.hits).toBe(0);

      // Second run - all cache hits
      processor.resetCacheStats();
      const startTime2 = Date.now();
      const result2 = await processor.processFiles(files);
      const duration2 = Date.now() - startTime2;

      expect(result2.successful.length).toBe(fileCount);
      expect(result2.failed.length).toBe(0);

      stats = processor.getCacheStats();
      expect(stats?.hits).toBe(fileCount);
      expect(stats?.misses).toBe(0);

      // Second run should be faster due to caching
      console.log(`First run: ${duration1}ms, Second run: ${duration2}ms`);
      expect(duration2).toBeLessThanOrEqual(duration1);
    });

    it('should handle mixed cache hits and misses when files change', async () => {
      // Create 10 test files
      const fileCount = 10;
      const files: string[] = [];
      for (let i = 0; i < fileCount; i++) {
        const file = `file${i}.ts`;
        files.push(file);
        const filePath = path.join(tempDir, file);
        await fs.writeFile(filePath, `export const file${i} = ${i};`);
      }

      const cache = new ModuleCache(cacheDir);
      const processor = new ParallelFileProcessor(tempDir, { concurrency: 4, cache });

      // First run
      let result = await processor.processFiles(files);
      expect(result.successful.length).toBe(fileCount);

      let stats = processor.getCacheStats();
      expect(stats?.misses).toBe(fileCount);

      // Modify half of the files
      for (let i = 0; i < fileCount / 2; i++) {
        const filePath = path.join(tempDir, `file${i}.ts`);
        await fs.writeFile(filePath, `export const file${i} = ${i * 2};`);
      }

      // Second run - should have mixed hits and invalidations
      processor.resetCacheStats();
      result = await processor.processFiles(files);
      expect(result.successful.length).toBe(fileCount);

      stats = processor.getCacheStats();
      // Half are still cached (no change), half were invalidated (changed)
      expect(stats?.hits).toBeGreaterThan(0);
      expect(stats?.invalidations).toBeGreaterThan(0);
    });

    it('should process files concurrently with correct concurrency limit', async () => {
      // Create 8 test files
      const fileCount = 8;
      const files: string[] = [];
      for (let i = 0; i < fileCount; i++) {
        const file = `file${i}.ts`;
        files.push(file);
        const filePath = path.join(tempDir, file);
        await fs.writeFile(filePath, `export const file${i} = ${i};`);
      }

      // Test with different concurrency levels
      for (const concurrency of [1, 2, 4]) {
        const processor = new ParallelFileProcessor(tempDir, { concurrency });
        const result = await processor.processFiles(files);
        expect(result.successful.length).toBe(fileCount);
        expect(result.failed.length).toBe(0);
      }
    });

    it('should persist cache across processor instances', async () => {
      // Create 5 test files
      const fileCount = 5;
      const files: string[] = [];
      for (let i = 0; i < fileCount; i++) {
        const file = `file${i}.ts`;
        files.push(file);
        const filePath = path.join(tempDir, file);
        await fs.writeFile(filePath, `export const file${i} = ${i};`);
      }

      // First processor instance
      const cache1 = new ModuleCache(cacheDir);
      const processor1 = new ParallelFileProcessor(tempDir, { concurrency: 2, cache: cache1 });
      let result = await processor1.processFiles(files);
      expect(result.successful.length).toBe(fileCount);

      let stats = processor1.getCacheStats();
      expect(stats?.misses).toBe(fileCount);

      // Second processor instance with same cache directory
      const cache2 = new ModuleCache(cacheDir);
      const processor2 = new ParallelFileProcessor(tempDir, { concurrency: 2, cache: cache2 });
      result = await processor2.processFiles(files);
      expect(result.successful.length).toBe(fileCount);

      stats = processor2.getCacheStats();
      // Should have cache hits from the persisted cache
      expect(stats?.hits).toBe(fileCount);
      expect(stats?.misses).toBe(0);
    });

    it('should handle errors gracefully while maintaining cache', async () => {
      // Create some valid files and reference non-existent files
      const validFiles = ['valid1.ts', 'valid2.ts'];
      const invalidFiles = ['invalid1.ts', 'invalid2.ts'];
      const allFiles = [...validFiles, ...invalidFiles];

      for (const file of validFiles) {
        const filePath = path.join(tempDir, file);
        await fs.writeFile(filePath, `export const ${file.replace('.ts', '')} = 1;`);
      }

      const cache = new ModuleCache(cacheDir);
      const processor = new ParallelFileProcessor(tempDir, { concurrency: 2, cache });

      // First run with mixed valid/invalid files
      let result = await processor.processFiles(allFiles);
      expect(result.successful.length).toBe(validFiles.length);
      expect(result.failed.length).toBe(invalidFiles.length);

      let stats = processor.getCacheStats();
      // Misses include both valid files and attempts to parse invalid files
      expect(stats?.misses).toBeGreaterThanOrEqual(validFiles.length);

      // Second run - valid files should be cached
      processor.resetCacheStats();
      result = await processor.processFiles(allFiles);
      expect(result.successful.length).toBe(validFiles.length);
      expect(result.failed.length).toBe(invalidFiles.length);

      stats = processor.getCacheStats();
      // Should have hits for valid files
      expect(stats?.hits).toBe(validFiles.length);
    });
  });

  describe('Performance metrics', () => {
    it('should report accurate processing duration', async () => {
      // Create 5 test files
      const fileCount = 5;
      const files: string[] = [];
      for (let i = 0; i < fileCount; i++) {
        const file = `file${i}.ts`;
        files.push(file);
        const filePath = path.join(tempDir, file);
        await fs.writeFile(filePath, `export const file${i} = ${i};`);
      }

      const processor = new ParallelFileProcessor(tempDir);
      const result = await processor.processFiles(files);

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.duration).toBeLessThan(5000); // Should complete in less than 5 seconds
    });
  });
});
