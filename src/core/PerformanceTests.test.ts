import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileDiscovery } from './FileDiscovery';
import { ASTParser } from '../parsers/ASTParser';
import { DependencyGraphBuilder } from './DependencyGraphBuilder';
import { ArchitectureClassifier } from './ArchitectureClassifier';
import { DiagramGenerator } from '../generators/DiagramGenerator';
import { ParallelFileProcessor } from './ParallelFileProcessor';
import { ModuleCache } from './ModuleCache';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Performance Tests for Architecture Diagram Generator
 * 
 * Tests the generator's ability to process large projects (500+ files)
 * within the 30-second performance requirement (Requirement 5.5)
 */
describe('Performance Tests - 500+ File Project', () => {
  let tempDir: string;
  let cacheDir: string;
  const TARGET_FILE_COUNT = 500;
  const PERFORMANCE_THRESHOLD_MS = 30000; // 30 seconds

  beforeEach(async () => {
    // Create temporary directories
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'perf-test-'));
    cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'perf-cache-'));
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

  /**
   * Generate realistic import statements for a module
   */
  function generateImports(dir: string, index: number, directories: string[]): string {
    const imports: string[] = [];
    
    // Add some internal imports
    const importCount = Math.min(3, Math.floor(Math.random() * 5));
    for (let i = 0; i < importCount; i++) {
      const randomDir = directories[Math.floor(Math.random() * directories.length)];
      const randomModule = Math.floor(Math.random() * 10);
      imports.push(`import { module${randomModule} } from '../${randomDir}/module${randomModule}';`);
    }

    // Add some external imports
    if (Math.random() > 0.5) {
      imports.push(`import { prisma } from '@prisma/client';`);
    }
    if (Math.random() > 0.7) {
      imports.push(`import axios from 'axios';`);
    }
    if (Math.random() > 0.8) {
      imports.push(`import { fetch } from 'node-fetch';`);
    }

    return imports.join('\n');
  }

  /**
   * Generate realistic external service calls
   */
  function generateExternalCalls(dir: string, index: number): string {
    const calls: string[] = [];

    if (dir.includes('api')) {
      calls.push(`
async function fetchExternalData() {
  const response = await fetch('https://api.example.com/data');
  return response.json();
}
      `);
    }

    if (dir.includes('services')) {
      calls.push(`
const dbClient = prisma.risk.findMany();
      `);
    }

    if (dir.includes('external')) {
      calls.push(`
const weatherData = axios.get('https://api.openweathermap.org/data/2.5/weather');
      `);
    }

    return calls.join('\n');
  }

  /**
   * Helper function to create a realistic project structure with 500+ files
   * Simulates a Next.js project with routes, components, utilities, and services
   */
  async function createLargeProjectFixture(fileCount: number): Promise<string[]> {
    const files: string[] = [];
    const directories = [
      'app/api/risk',
      'app/api/weather',
      'app/api/hydrology',
      'app/dashboard',
      'app/monitoring',
      'components/risk-validator',
      'components/charts',
      'components/maps',
      'lib/services',
      'lib/utils',
      'lib/calculations',
      'lib/validators',
      'services/external',
      'services/data',
      'utils/helpers',
      'utils/formatters',
      'utils/validators',
    ];

    // Create directory structure
    for (const dir of directories) {
      const dirPath = path.join(tempDir, dir);
      await fs.mkdir(dirPath, { recursive: true });
    }

    // Distribute files across directories
    const filesPerDir = Math.ceil(fileCount / directories.length);
    let fileIndex = 0;

    for (const dir of directories) {
      for (let i = 0; i < filesPerDir && fileIndex < fileCount; i++) {
        const fileName = `module${i}.ts`;
        const filePath = path.join(tempDir, dir, fileName);
        
        // Create realistic TypeScript content with imports and exports
        const imports = generateImports(dir, i, directories);
        const exports = `export const module${i} = { id: ${i}, name: 'module${i}' };`;
        const externalCalls = generateExternalCalls(dir, i);
        
        const content = `${imports}\n\n${externalCalls}\n\n${exports}`;
        await fs.writeFile(filePath, content);
        
        files.push(path.join(dir, fileName));
        fileIndex++;
      }
    }

    return files;
  }

  describe('Complete Pipeline Performance', () => {
    it('should process 500+ files within 30 seconds', async () => {
      // Create fixture with 500+ files
      const files = await createLargeProjectFixture(TARGET_FILE_COUNT);
      expect(files.length).toBeGreaterThanOrEqual(TARGET_FILE_COUNT);

      // Measure complete pipeline execution
      const startTime = Date.now();

      // Step 1: File Discovery
      const discovery = new FileDiscovery();
      const fileList = await discovery.discover(tempDir, {
        rootDir: tempDir,
        include: ['**/*.ts', '**/*.tsx'],
        exclude: ['**/*.test.ts', '**/*.spec.ts', 'node_modules/**'],
      });

      // Flatten file list into array
      const discoveredFiles = [
        ...fileList.routes,
        ...fileList.api,
        ...fileList.components,
        ...fileList.utilities,
        ...(fileList.config || []),
      ].map(f => path.join(tempDir, f));

      // Step 2: Parse files with caching and parallelization
      const cache = new ModuleCache(cacheDir);
      const processor = new ParallelFileProcessor(tempDir, {
        concurrency: 4,
        cache,
      });

      const processingResult = await processor.processFiles(discoveredFiles);
      expect(processingResult.successful.length).toBeGreaterThan(0);

      // Step 3: Build dependency graph
      const graphBuilder = new DependencyGraphBuilder(tempDir);
      const graph = graphBuilder.build(processingResult.successful);
      expect(graph.nodes.size).toBeGreaterThan(0);

      // Step 4: Classify architecture
      const classifier = new ArchitectureClassifier();
      const classifiedGraph = classifier.classify(graph, {
        rootDir: tempDir,
        include: ['**/*.ts', '**/*.tsx'],
        exclude: ['**/*.test.ts', '**/*.spec.ts'],
        layers: [],
        domains: [],
        externalServices: [],
        output: {
          formats: ['markdown'],
          directory: tempDir,
          simplified: true,
          detailed: true,
        },
        plugins: [],
      });

      // Step 5: Generate diagram
      const generator = new DiagramGenerator();
      const diagram = generator.generate(classifiedGraph, {
        includeExternalServices: true,
        groupByLayer: true,
        groupByDomain: true,
        maxNodesPerDomain: 50,
        showDependencies: true,
      });

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // Verify performance requirement
      expect(totalDuration).toBeLessThanOrEqual(PERFORMANCE_THRESHOLD_MS);
      console.log(`✓ Complete pipeline processed ${discoveredFiles.length} files in ${totalDuration}ms`);
    });

    it('should process 500+ files with caching enabled within 30 seconds', async () => {
      // Create fixture
      const files = await createLargeProjectFixture(TARGET_FILE_COUNT);
      expect(files.length).toBeGreaterThanOrEqual(TARGET_FILE_COUNT);

      // First run - populate cache
      const discovery = new FileDiscovery();
      const fileList = await discovery.discover(tempDir, {
        rootDir: tempDir,
        include: ['**/*.ts', '**/*.tsx'],
        exclude: ['**/*.test.ts', '**/*.spec.ts', 'node_modules/**'],
      });

      const discoveredFiles = [
        ...fileList.routes,
        ...fileList.api,
        ...fileList.components,
        ...fileList.utilities,
        ...(fileList.config || []),
      ].map(f => path.join(tempDir, f));

      const cache = new ModuleCache(cacheDir);
      const processor = new ParallelFileProcessor(tempDir, {
        concurrency: 4,
        cache,
      });

      await processor.processFiles(discoveredFiles);

      // Second run - measure with cache hits
      const startTime = Date.now();

      const processingResult = await processor.processFiles(discoveredFiles);
      const graphBuilder = new DependencyGraphBuilder(tempDir);
      const graph = graphBuilder.build(processingResult.successful);
      const classifier = new ArchitectureClassifier();
      const classifiedGraph = classifier.classify(graph, {
        rootDir: tempDir,
        include: ['**/*.ts', '**/*.tsx'],
        exclude: ['**/*.test.ts', '**/*.spec.ts'],
        layers: [],
        domains: [],
        externalServices: [],
        output: {
          formats: ['markdown'],
          directory: tempDir,
          simplified: true,
          detailed: true,
        },
        plugins: [],
      });

      const generator = new DiagramGenerator();
      if (classifiedGraph.nodes.size > 0) {
        generator.generate(classifiedGraph, {
          includeExternalServices: true,
          groupByLayer: true,
          groupByDomain: true,
          maxNodesPerDomain: 50,
          showDependencies: true,
        });
      }

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // Verify performance with cache
      expect(totalDuration).toBeLessThanOrEqual(PERFORMANCE_THRESHOLD_MS);
      console.log(`✓ Cached pipeline processed ${discoveredFiles.length} files in ${totalDuration}ms`);
    });
  });

  describe('Component-Level Performance', () => {
    it('should parse 500+ files within reasonable time', async () => {
      const files = await createLargeProjectFixture(TARGET_FILE_COUNT);
      const discoveredFiles = files.map(f => path.join(tempDir, f));

      const startTime = Date.now();

      const cache = new ModuleCache(cacheDir);
      const processor = new ParallelFileProcessor(tempDir, {
        concurrency: 4,
        cache,
      });

      const result = await processor.processFiles(discoveredFiles);

      const duration = Date.now() - startTime;

      expect(result.successful.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`✓ Parsed ${result.successful.length} files in ${duration}ms`);
    });

    it('should build dependency graph for 500+ files efficiently', async () => {
      const files = await createLargeProjectFixture(TARGET_FILE_COUNT);
      const discoveredFiles = files.map(f => path.join(tempDir, f));

      const cache = new ModuleCache(cacheDir);
      const processor = new ParallelFileProcessor(tempDir, {
        concurrency: 4,
        cache,
      });

      const processingResult = await processor.processFiles(discoveredFiles);

      const startTime = Date.now();

      const graphBuilder = new DependencyGraphBuilder(tempDir);
      const graph = graphBuilder.build(processingResult.successful);

      const duration = Date.now() - startTime;

      expect(graph.nodes.size).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5000); // Graph building should be fast
      console.log(`✓ Built dependency graph with ${graph.nodes.size} nodes in ${duration}ms`);
    });

    it('should classify architecture for 500+ files efficiently', async () => {
      const files = await createLargeProjectFixture(TARGET_FILE_COUNT);
      const discoveredFiles = files.map(f => path.join(tempDir, f));

      const cache = new ModuleCache(cacheDir);
      const processor = new ParallelFileProcessor(tempDir, {
        concurrency: 4,
        cache,
      });

      const processingResult = await processor.processFiles(discoveredFiles);
      const graphBuilder = new DependencyGraphBuilder(tempDir);
      const graph = graphBuilder.build(processingResult.successful);

      const startTime = Date.now();

      const classifier = new ArchitectureClassifier();
      const classifiedGraph = classifier.classify(graph, {
        rootDir: tempDir,
        include: ['**/*.ts', '**/*.tsx'],
        exclude: ['**/*.test.ts', '**/*.spec.ts'],
        layers: [],
        domains: [],
        externalServices: [],
        output: {
          formats: ['markdown'],
          directory: tempDir,
          simplified: true,
          detailed: true,
        },
        plugins: [],
      });

      const duration = Date.now() - startTime;

      expect(classifiedGraph.nodes.size).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5000); // Classification should be fast
      console.log(`✓ Classified architecture in ${duration}ms`);
    });

    it('should generate diagram for 500+ files efficiently', async () => {
      const files = await createLargeProjectFixture(TARGET_FILE_COUNT);
      const discoveredFiles = files.map(f => path.join(tempDir, f));

      const cache = new ModuleCache(cacheDir);
      const processor = new ParallelFileProcessor(tempDir, {
        concurrency: 4,
        cache,
      });

      const processingResult = await processor.processFiles(discoveredFiles);
      const graphBuilder = new DependencyGraphBuilder(tempDir);
      const graph = graphBuilder.build(processingResult.successful);
      const classifier = new ArchitectureClassifier();
      const classifiedGraph = classifier.classify(graph, {
        rootDir: tempDir,
        include: ['**/*.ts', '**/*.tsx'],
        exclude: ['**/*.test.ts', '**/*.spec.ts'],
        layers: [],
        domains: [],
        externalServices: [],
        output: {
          formats: ['markdown'],
          directory: tempDir,
          simplified: true,
          detailed: true,
        },
        plugins: [],
      });

      const startTime = Date.now();

      const generator = new DiagramGenerator();
      const diagram = generator.generate(classifiedGraph, {
        includeExternalServices: true,
        groupByLayer: true,
        groupByDomain: true,
        maxNodesPerDomain: 50,
        showDependencies: true,
      });

      const duration = Date.now() - startTime;

      expect(diagram.syntax.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5000); // Generation should be fast
      console.log(`✓ Generated diagram in ${duration}ms`);
    });
  });

  describe('Memory Usage and Efficiency', () => {
    it('should maintain reasonable memory usage for 500+ files', async () => {
      const files = await createLargeProjectFixture(TARGET_FILE_COUNT);
      const discoveredFiles = files.map(f => path.join(tempDir, f));

      // Get initial memory usage
      const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB

      const cache = new ModuleCache(cacheDir);
      const processor = new ParallelFileProcessor(tempDir, {
        concurrency: 4,
        cache,
      });

      const processingResult = await processor.processFiles(discoveredFiles);
      const graphBuilder = new DependencyGraphBuilder(tempDir);
      const graph = graphBuilder.build(processingResult.successful);
      const classifier = new ArchitectureClassifier();
      const classifiedGraph = classifier.classify(graph, {
        rootDir: tempDir,
        include: ['**/*.ts', '**/*.tsx'],
        exclude: ['**/*.test.ts', '**/*.spec.ts'],
        layers: [],
        domains: [],
        externalServices: [],
        output: {
          formats: ['markdown'],
          directory: tempDir,
          simplified: true,
          detailed: true,
        },
        plugins: [],
      });

      const generator = new DiagramGenerator();
      generator.generate(classifiedGraph, {
        includeExternalServices: true,
        groupByLayer: true,
        groupByDomain: true,
        maxNodesPerDomain: 50,
        showDependencies: true,
      });

      // Get final memory usage
      const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 500MB for 500 files)
      expect(memoryIncrease).toBeLessThan(500);
      console.log(`✓ Memory usage: ${initialMemory.toFixed(2)}MB → ${finalMemory.toFixed(2)}MB (Δ ${memoryIncrease.toFixed(2)}MB)`);
    });

    it('should show cache effectiveness with repeated processing', async () => {
      const files = await createLargeProjectFixture(TARGET_FILE_COUNT);
      const discoveredFiles = files.map(f => path.join(tempDir, f));

      const cache = new ModuleCache(cacheDir);
      const processor = new ParallelFileProcessor(tempDir, {
        concurrency: 4,
        cache,
      });

      // First run - populate cache
      const result1 = await processor.processFiles(discoveredFiles);
      const stats1 = processor.getCacheStats();

      // Second run - should have cache hits
      processor.resetCacheStats();
      const result2 = await processor.processFiles(discoveredFiles);
      const stats2 = processor.getCacheStats();

      expect(stats1?.misses).toBeGreaterThan(0);
      expect(stats2?.hits).toBeGreaterThan(0);
      expect(stats2?.hits).toBeGreaterThanOrEqual(stats1?.misses || 0);

      console.log(`✓ Cache effectiveness: First run ${stats1?.misses} misses, Second run ${stats2?.hits} hits`);
    });
  });

  describe('Scalability Tests', () => {
    it('should handle 500+ files with realistic project structure', async () => {
      const files = await createLargeProjectFixture(TARGET_FILE_COUNT);
      expect(files.length).toBeGreaterThanOrEqual(TARGET_FILE_COUNT);

      const discovery = new FileDiscovery();
      const fileList = await discovery.discover(tempDir, {
        rootDir: tempDir,
        include: ['**/*.ts', '**/*.tsx'],
        exclude: ['**/*.test.ts', '**/*.spec.ts', 'node_modules/**'],
      });

      const discoveredFiles = [
        ...fileList.routes,
        ...fileList.api,
        ...fileList.components,
        ...fileList.utilities,
        ...(fileList.config || []),
      ];

      expect(discoveredFiles.length).toBeGreaterThanOrEqual(TARGET_FILE_COUNT);
      console.log(`✓ Discovered ${discoveredFiles.length} files in realistic project structure`);
    });

    it('should complete full pipeline within performance threshold', async () => {
      const files = await createLargeProjectFixture(TARGET_FILE_COUNT);

      const startTime = Date.now();

      const discovery = new FileDiscovery();
      const fileList = await discovery.discover(tempDir, {
        rootDir: tempDir,
        include: ['**/*.ts', '**/*.tsx'],
        exclude: ['**/*.test.ts', '**/*.spec.ts', 'node_modules/**'],
      });

      const discoveredFiles = [
        ...fileList.routes,
        ...fileList.api,
        ...fileList.components,
        ...fileList.utilities,
        ...(fileList.config || []),
      ].map(f => path.join(tempDir, f));

      const cache = new ModuleCache(cacheDir);
      const processor = new ParallelFileProcessor(tempDir, {
        concurrency: 4,
        cache,
      });

      const processingResult = await processor.processFiles(discoveredFiles);
      const graphBuilder = new DependencyGraphBuilder(tempDir);
      const graph = graphBuilder.build(processingResult.successful);
      const classifier = new ArchitectureClassifier();
      const classifiedGraph = classifier.classify(graph, {
        rootDir: tempDir,
        include: ['**/*.ts', '**/*.tsx'],
        exclude: ['**/*.test.ts', '**/*.spec.ts'],
        layers: [],
        domains: [],
        externalServices: [],
        output: {
          formats: ['markdown'],
          directory: tempDir,
          simplified: true,
          detailed: true,
        },
        plugins: [],
      });

      const generator = new DiagramGenerator();
      if (classifiedGraph.nodes.size > 0) {
        generator.generate(classifiedGraph, {
          includeExternalServices: true,
          groupByLayer: true,
          groupByDomain: true,
          maxNodesPerDomain: 50,
          showDependencies: true,
        });
      }

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      expect(totalDuration).toBeLessThanOrEqual(PERFORMANCE_THRESHOLD_MS);
      console.log(`✓ Full pipeline completed in ${totalDuration}ms (threshold: ${PERFORMANCE_THRESHOLD_MS}ms)`);
    });
  });
});
