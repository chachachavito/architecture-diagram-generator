import { ModuleCache } from './ModuleCache';
import { ParsedModule } from '../parsers';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('ModuleCache', () => {
  let cache: ModuleCache;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for cache
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'module-cache-'));
    cache = new ModuleCache(tempDir);
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

  describe('get() and set()', () => {
    it('should cache and retrieve a parsed module', async () => {
      const filePath = path.join(os.tmpdir(), 'test-file.ts');
      const testContent = 'export const test = 1;';
      
      // Create test file
      await fs.writeFile(filePath, testContent);

      try {
        const module: ParsedModule = {
          path: 'test-file.ts',
          imports: [],
          exports: [{ name: 'test', type: 'variable', isDefault: false }],
          externalCalls: [],
          metadata: { hasDefaultExport: false, isReactComponent: false, isApiRoute: false },
        };

        // Store in cache
        await cache.set(filePath, module);

        // Retrieve from cache
        const cached = await cache.get(filePath);
        expect(cached).toEqual(module);
      } finally {
        await fs.unlink(filePath);
      }
    });

    it('should return null for non-cached modules', async () => {
      const filePath = path.join(os.tmpdir(), 'non-existent.ts');
      const cached = await cache.get(filePath);
      expect(cached).toBeNull();
    });

    it('should invalidate cache when file changes', async () => {
      const filePath = path.join(os.tmpdir(), 'changing-file.ts');
      const initialContent = 'export const test = 1;';
      
      // Create test file
      await fs.writeFile(filePath, initialContent);

      try {
        const module: ParsedModule = {
          path: 'changing-file.ts',
          imports: [],
          exports: [{ name: 'test', type: 'variable', isDefault: false }],
          externalCalls: [],
          metadata: { hasDefaultExport: false, isReactComponent: false, isApiRoute: false },
        };

        // Store in cache
        await cache.set(filePath, module);

        // Verify it's cached
        let cached = await cache.get(filePath);
        expect(cached).toEqual(module);

        // Modify file
        await fs.writeFile(filePath, 'export const test = 2;');

        // Cache should be invalidated
        cached = await cache.get(filePath);
        expect(cached).toBeNull();
      } finally {
        await fs.unlink(filePath);
      }
    });
  });

  describe('clear()', () => {
    it('should clear all cache entries', async () => {
      const filePath = path.join(os.tmpdir(), 'test-file.ts');
      const testContent = 'export const test = 1;';
      
      await fs.writeFile(filePath, testContent);

      try {
        const module: ParsedModule = {
          path: 'test-file.ts',
          imports: [],
          exports: [{ name: 'test', type: 'variable', isDefault: false }],
          externalCalls: [],
          metadata: { hasDefaultExport: false, isReactComponent: false, isApiRoute: false },
        };

        await cache.set(filePath, module);
        expect(await cache.get(filePath)).toEqual(module);

        await cache.clear();
        expect(await cache.get(filePath)).toBeNull();
      } finally {
        await fs.unlink(filePath);
      }
    });
  });

  describe('getStats()', () => {
    it('should track cache hits and misses', async () => {
      const filePath = path.join(os.tmpdir(), 'stats-test.ts');
      const testContent = 'export const test = 1;';
      
      await fs.writeFile(filePath, testContent);

      try {
        const module: ParsedModule = {
          path: 'stats-test.ts',
          imports: [],
          exports: [{ name: 'test', type: 'variable', isDefault: false }],
          externalCalls: [],
          metadata: { hasDefaultExport: false, isReactComponent: false, isApiRoute: false },
        };

        // Initial miss
        await cache.get(filePath);
        let stats = cache.getStats();
        expect(stats.misses).toBe(1);
        expect(stats.hits).toBe(0);

        // Store in cache
        await cache.set(filePath, module);

        // Hit
        await cache.get(filePath);
        stats = cache.getStats();
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(1);

        // Another hit
        await cache.get(filePath);
        stats = cache.getStats();
        expect(stats.hits).toBe(2);
      } finally {
        await fs.unlink(filePath);
      }
    });

    it('should track cache invalidations', async () => {
      const filePath = path.join(os.tmpdir(), 'invalidation-test.ts');
      const testContent = 'export const test = 1;';
      
      await fs.writeFile(filePath, testContent);

      try {
        const module: ParsedModule = {
          path: 'invalidation-test.ts',
          imports: [],
          exports: [{ name: 'test', type: 'variable', isDefault: false }],
          externalCalls: [],
          metadata: { hasDefaultExport: false, isReactComponent: false, isApiRoute: false },
        };

        await cache.set(filePath, module);
        await cache.get(filePath);

        // Modify file to trigger invalidation
        await fs.writeFile(filePath, 'export const test = 2;');
        await cache.get(filePath);

        const stats = cache.getStats();
        expect(stats.invalidations).toBe(1);
      } finally {
        await fs.unlink(filePath);
      }
    });
  });

  describe('resetStats()', () => {
    it('should reset statistics', async () => {
      const filePath = path.join(os.tmpdir(), 'reset-test.ts');
      const testContent = 'export const test = 1;';
      
      await fs.writeFile(filePath, testContent);

      try {
        const module: ParsedModule = {
          path: 'reset-test.ts',
          imports: [],
          exports: [{ name: 'test', type: 'variable', isDefault: false }],
          externalCalls: [],
          metadata: { hasDefaultExport: false, isReactComponent: false, isApiRoute: false },
        };

        await cache.set(filePath, module);
        await cache.get(filePath);

        let stats = cache.getStats();
        expect(stats.hits).toBe(1);

        cache.resetStats();
        stats = cache.getStats();
        expect(stats.hits).toBe(0);
        expect(stats.misses).toBe(0);
        expect(stats.invalidations).toBe(0);
      } finally {
        await fs.unlink(filePath);
      }
    });
  });

  describe('in-memory cache without persistence', () => {
    it('should work without persistent cache directory', async () => {
      const inMemoryCache = new ModuleCache();
      const filePath = path.join(os.tmpdir(), 'in-memory-test.ts');
      const testContent = 'export const test = 1;';
      
      await fs.writeFile(filePath, testContent);

      try {
        const module: ParsedModule = {
          path: 'in-memory-test.ts',
          imports: [],
          exports: [{ name: 'test', type: 'variable', isDefault: false }],
          externalCalls: [],
          metadata: { hasDefaultExport: false, isReactComponent: false, isApiRoute: false },
        };

        await inMemoryCache.set(filePath, module);
        const cached = await inMemoryCache.get(filePath);
        expect(cached).toEqual(module);
      } finally {
        await fs.unlink(filePath);
      }
    });
  });
});
