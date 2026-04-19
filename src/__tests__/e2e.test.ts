import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { ConfigurationLoader, DEFAULT_CONFIG } from '../core/ConfigurationLoader';
import { DependencyGraphBuilder } from '../core/DependencyGraphBuilder';
import { ArchitectureClassifier } from '../core/ArchitectureClassifier';
import { DiagramGenerator } from '../generators/DiagramGenerator';
import { MetadataGenerator, ChangeDetector } from '../core/MetadataGenerator';
import { PluginManager } from '../core/PluginManager';
import type { ParsedModule } from '../parsers/ASTParser';

/**
 * End-to-end integration tests for the Architecture Diagram Generator.
 * Tests the complete workflow using mock data.
 */

// Helper to create mock parsed modules
function createMockModule(filePath: string, imports: string[] = []): ParsedModule {
  return {
    path: filePath,
    imports: imports.map(source => ({
      source,
      specifiers: [],
      isExternal: source.startsWith('@') || !source.startsWith('.'),
    })),
    exports: [],
    externalCalls: [],
    metadata: {},
  };
}

describe('End-to-End Integration Tests', () => {
  const testOutputDir = './test-e2e-output';

  beforeAll(async () => {
    await fs.mkdir(testOutputDir, { recursive: true });
  });

  afterAll(async () => {
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe('Complete Pipeline', () => {
    it('should run the complete pipeline with mock data', async () => {
      // 1. Load configuration
      const loader = new ConfigurationLoader();
      const config = await loader.load();
      
      expect(config).toBeDefined();
      expect(config.rootDir).toBeDefined();

      // 2. Create mock modules
      const modules = [
        createMockModule('app/page.tsx', ['./components/Header', './lib/utils']),
        createMockModule('app/api/route.ts', ['./services/data', '@prisma/client']),
        createMockModule('components/Header.tsx', ['./lib/utils']),
        createMockModule('lib/utils.ts', []),
        createMockModule('services/data.ts', ['@prisma/client']),
      ];
      
      expect(modules.length).toBe(5);

      // 3. Build dependency graph
      const builder = new DependencyGraphBuilder();
      const graph = builder.build(modules);
      
      expect(graph).toBeDefined();
      expect(graph.nodes.size).toBeGreaterThan(0);

      // 4. Classify architecture
      const classifier = new ArchitectureClassifier();
      const classified = classifier.classify(graph, config);
      
      expect(classified).toBeDefined();
      expect(classified.layers).toBeDefined();

      // 5. Generate diagram
      const generator = new DiagramGenerator();
      const diagram = generator.generateDetailed(classified);
      
      expect(diagram).toBeDefined();
      expect(diagram.syntax).toBeDefined();
      expect(diagram.syntax).toContain('graph');
      expect(diagram.metadata).toBeDefined();

      // 6. Save output
      const outputPath = path.join(testOutputDir, 'architecture.md');
      const content = `# Architecture Diagram\n\n\`\`\`mermaid\n${diagram.syntax}\n\`\`\`\n`;
      await fs.writeFile(outputPath, content, 'utf-8');
      
      const saved = await fs.readFile(outputPath, 'utf-8');
      expect(saved).toContain('mermaid');
    });

    it('should generate simplified and detailed diagrams', async () => {
      const modules = [
        createMockModule('app/page.tsx', ['./components/Header']),
        createMockModule('app/api/route.ts', ['./services/data']),
        createMockModule('components/Header.tsx', []),
        createMockModule('services/data.ts', []),
      ];
      
      const loader = new ConfigurationLoader();
      const config = await loader.load();
      
      const builder = new DependencyGraphBuilder();
      const graph = builder.build(modules);
      
      const classifier = new ArchitectureClassifier();
      const classified = classifier.classify(graph, config);
      
      const generator = new DiagramGenerator();
      
      const simplified = generator.generateSimplified(classified);
      const detailed = generator.generateDetailed(classified);
      
      expect(simplified.syntax).toBeDefined();
      expect(detailed.syntax).toBeDefined();
      
      // Both should contain graph definition
      expect(simplified.syntax).toContain('graph');
      expect(detailed.syntax).toContain('graph');
    });
  });

  describe('Metadata and Change Tracking', () => {
    it('should generate and save metadata', async () => {
      const modules = [
        createMockModule('app/page.tsx', ['./lib/utils']),
        createMockModule('lib/utils.ts', []),
      ];
      
      const loader = new ConfigurationLoader();
      const config = await loader.load();
      
      const builder = new DependencyGraphBuilder();
      const graph = builder.build(modules);
      
      const classifier = new ArchitectureClassifier();
      const classified = classifier.classify(graph, config);
      
      // Generate metadata
      const metadataGenerator = new MetadataGenerator();
      const metadata = metadataGenerator.generate(classified, './');
      
      expect(metadata.nodeCount).toBeGreaterThan(0);
      expect(metadata.generatedAt).toBeDefined();
      
      // Save metadata
      const metadataPath = path.join(testOutputDir, 'metadata.json');
      await metadataGenerator.saveToFile(metadata, metadataPath);
      
      const loaded = await metadataGenerator.loadFromFile(metadataPath);
      expect(loaded).not.toBeNull();
      expect(loaded?.nodeCount).toBe(metadata.nodeCount);
    });

    it('should detect changes between graphs', async () => {
      // Create two simple graphs
      const graph1 = {
        nodes: new Map([
          ['a', { id: 'a', type: 'component' as const, externalCalls: [] }],
          ['b', { id: 'b', type: 'component' as const, externalCalls: [] }],
        ]),
        edges: [{ from: 'a', to: 'b', type: 'import' as const }],
      };
      
      const graph2 = {
        nodes: new Map([
          ['a', { id: 'a', type: 'component' as const, externalCalls: [] }],
          ['b', { id: 'b', type: 'api' as const, externalCalls: [] }], // Changed type
          ['c', { id: 'c', type: 'component' as const, externalCalls: [] }], // Added
        ]),
        edges: [
          { from: 'a', to: 'b', type: 'import' as const },
          { from: 'a', to: 'c', type: 'import' as const }, // Added
        ],
      };
      
      const detector = new ChangeDetector();
      const changes = detector.detect(graph2, graph1);
      
      expect(changes.addedNodes).toContain('c');
      expect(changes.modifiedNodes).toHaveLength(1);
      expect(changes.addedEdges).toHaveLength(1);
    });
  });

  describe('Plugin System', () => {
    it('should execute plugin hooks in pipeline', async () => {
      const manager = new PluginManager();
      
      const hookCalls: string[] = [];
      
      manager.register({
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          beforeDiscovery: async () => {
            hookCalls.push('beforeDiscovery');
          },
          afterGeneration: async () => {
            hookCalls.push('afterGeneration');
          },
        },
      });

      // Simulate pipeline
      await manager.execute('beforeDiscovery', DEFAULT_CONFIG);
      await manager.execute('afterGeneration', {
        syntax: 'graph TB\n  A --> B',
        metadata: {
          nodeCount: 2,
          edgeCount: 1,
          layers: [],
          domains: [],
          externalServices: [],
          generatedAt: new Date(),
        },
      });

      expect(hookCalls).toContain('beforeDiscovery');
      expect(hookCalls).toContain('afterGeneration');
    });

    it('should isolate plugin errors', async () => {
      const manager = new PluginManager();
      
      const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      manager.register({
        name: 'failing-plugin',
        version: '1.0.0',
        hooks: {
          beforeDiscovery: async () => {
            throw new Error('Plugin error');
          },
        },
      });

      manager.register({
        name: 'success-plugin',
        version: '1.0.0',
        hooks: {
          beforeDiscovery: async () => {
            // This should still run
          },
        },
      });

      const results = await manager.execute('beforeDiscovery', DEFAULT_CONFIG);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);
      
      mockError.mockRestore();
    });
  });

  describe('Configuration', () => {
    it('should load and validate configuration', async () => {
      const loader = new ConfigurationLoader();
      const config = await loader.load();
      
      expect(config.version).toBe('1.0.0');
      expect(config.include).toBeDefined();
      expect(config.exclude).toBeDefined();
      expect(config.layers).toBeDefined();
    });

    it('should migrate old configuration', async () => {
      const loader = new ConfigurationLoader();
      
      // Config without version
      const oldConfig = {
        rootDir: './src',
        include: ['app/**'],
      };
      
      const migrated = loader.migrate(oldConfig);
      
      expect(migrated.version).toBe('1.0.0');
      expect(migrated.rootDir).toBe('./src');
    });
  });
});
