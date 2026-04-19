import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import {
  MetadataGenerator,
  ChangeDetector,
  ChangeHighlighter,
  type ArchitectureMetadata,
  type ChangeDetectionResult,
} from './MetadataGenerator';
import type { DependencyGraph, GraphNode, GraphEdge } from './DependencyGraph';
import type { ClassifiedGraph } from './ArchitectureClassifier';

// ─── Test Fixtures ────────────────────────────────────────────────────────────

const createNode = (
  id: string,
  type: GraphNode['type'] = 'component',
  layer?: string,
  domain?: string
): GraphNode => ({
  id,
  type,
  layer,
  domain,
  externalCalls: [],
});

const createEdge = (from: string, to: string, type: GraphEdge['type'] = 'import'): GraphEdge => ({
  from,
  to,
  type,
});

const createGraph = (nodes: GraphNode[], edges: GraphEdge[] = []): DependencyGraph => ({
  nodes: new Map(nodes.map(n => [n.id, n])),
  edges,
});

const createClassifiedGraph = (
  nodes: GraphNode[],
  edges: GraphEdge[] = [],
  layers?: Map<string, GraphNode[]>,
  domains?: Map<string, GraphNode[]>
): ClassifiedGraph => {
  const graph = createGraph(nodes, edges);
  return {
    ...graph,
    layers: layers || new Map(),
    domains: domains || new Map(),
  };
};

// ─── MetadataGenerator Tests ──────────────────────────────────────────────────

describe('MetadataGenerator', () => {
  let generator: MetadataGenerator;
  const testOutputDir = './test-metadata-output';

  beforeEach(() => {
    generator = new MetadataGenerator();
  });

  afterEach(async () => {
    // Clean up test output
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
  });

  describe('generate', () => {
    it('should generate metadata from a basic graph', () => {
      const nodes = [
        createNode('app/page.tsx', 'component', 'UI', 'main'),
        createNode('app/api/route.ts', 'api', 'API', 'main'),
      ];
      const edges = [createEdge('app/page.tsx', 'app/api/route.ts')];
      const graph = createGraph(nodes, edges);

      const metadata = generator.generate(graph, './project');

      expect(metadata.nodeCount).toBe(2);
      expect(metadata.edgeCount).toBe(1);
      expect(metadata.rootDir).toBe('./project');
      expect(metadata.generatedAt).toBeDefined();
      expect(metadata.generatorVersion).toBe('1.0.0');
    });

    it('should count nodes by layer', () => {
      const nodes = [
        createNode('app/page1.tsx', 'component', 'UI'),
        createNode('app/page2.tsx', 'component', 'UI'),
        createNode('app/api/route.ts', 'api', 'API'),
      ];
      const graph = createGraph(nodes);

      const metadata = generator.generate(graph);

      expect(metadata.layerCounts['UI']).toBe(2);
      expect(metadata.layerCounts['API']).toBe(1);
      expect(metadata.layers).toContain('UI');
      expect(metadata.layers).toContain('API');
    });

    it('should count nodes by domain', () => {
      const nodes = [
        createNode('app/risk/page.tsx', 'component', 'UI', 'Risk'),
        createNode('app/weather/page.tsx', 'component', 'UI', 'Weather'),
        createNode('app/risk/api.ts', 'api', 'API', 'Risk'),
      ];
      const graph = createGraph(nodes);

      const metadata = generator.generate(graph);

      expect(metadata.domainCounts['Risk']).toBe(2);
      expect(metadata.domainCounts['Weather']).toBe(1);
      expect(metadata.domains).toContain('Risk');
      expect(metadata.domains).toContain('Weather');
    });

    it('should extract external services', () => {
      const nodes = [
        createNode('app/page.tsx', 'component', 'UI'),
        createNode('prisma', 'external-service', 'Data'),
        createNode('openweather-api', 'external-service', 'External'),
      ];
      const graph = createGraph(nodes);

      const metadata = generator.generate(graph);

      expect(metadata.externalServices).toContain('prisma');
      expect(metadata.externalServices).toContain('openweather-api');
    });

    it('should use classified graph layers and domains', () => {
      const nodes = [
        createNode('app/page.tsx', 'component'),
        createNode('lib/utils.ts', 'utility'),
      ];
      const layers = new Map([
        ['UI', [nodes[0]]],
        ['Processing', [nodes[1]]],
      ]);
      const domains = new Map([
        ['Main', [nodes[0]]],
      ]);
      const graph = createClassifiedGraph(nodes, [], layers, domains);

      const metadata = generator.generate(graph);

      expect(metadata.layerCounts['UI']).toBe(1);
      expect(metadata.layerCounts['Processing']).toBe(1);
      expect(metadata.domainCounts['Main']).toBe(1);
    });

    it('should include config file path when provided', () => {
      const graph = createGraph([]);
      const metadata = generator.generate(graph, './', 'architecture-config.json');

      expect(metadata.configFile).toBe('architecture-config.json');
    });
  });

  describe('saveToFile and loadFromFile', () => {
    it('should save and load metadata from file', async () => {
      const nodes = [createNode('app/page.tsx', 'component', 'UI')];
      const graph = createGraph(nodes);
      const metadata = generator.generate(graph);

      const outputPath = path.join(testOutputDir, 'metadata.json');
      await generator.saveToFile(metadata, outputPath);

      const loaded = await generator.loadFromFile(outputPath);

      expect(loaded).not.toBeNull();
      expect(loaded?.nodeCount).toBe(1);
      expect(loaded?.layers).toContain('UI');
    });

    it('should return null when loading non-existent file', async () => {
      const loaded = await generator.loadFromFile('./non-existent-file.json');
      expect(loaded).toBeNull();
    });
  });
});

// ─── ChangeDetector Tests ──────────────────────────────────────────────────────

describe('ChangeDetector', () => {
  let detector: ChangeDetector;
  const testOutputDir = './test-change-output';

  beforeEach(() => {
    detector = new ChangeDetector();
  });

  afterEach(async () => {
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe('detect', () => {
    it('should detect added nodes', () => {
      const previous = createGraph([
        createNode('app/page.tsx', 'component'),
      ]);
      const current = createGraph([
        createNode('app/page.tsx', 'component'),
        createNode('app/new.tsx', 'component'),
      ]);

      const result = detector.detect(current, previous);

      expect(result.addedNodes).toContain('app/new.tsx');
      expect(result.removedNodes).toHaveLength(0);
      expect(result.summary.addedCount).toBe(1);
    });

    it('should detect removed nodes', () => {
      const previous = createGraph([
        createNode('app/page.tsx', 'component'),
        createNode('app/old.tsx', 'component'),
      ]);
      const current = createGraph([
        createNode('app/page.tsx', 'component'),
      ]);

      const result = detector.detect(current, previous);

      expect(result.removedNodes).toContain('app/old.tsx');
      expect(result.addedNodes).toHaveLength(0);
      expect(result.summary.removedCount).toBe(1);
    });

    it('should detect modified nodes', () => {
      const previous = createGraph([
        createNode('app/page.tsx', 'component', 'UI', 'main'),
      ]);
      const current = createGraph([
        createNode('app/page.tsx', 'component', 'API', 'main'),
      ]);

      const result = detector.detect(current, previous);

      expect(result.modifiedNodes).toHaveLength(1);
      expect(result.modifiedNodes[0].nodeId).toBe('app/page.tsx');
      expect(result.modifiedNodes[0].changes).toContain('layer: UI → API');
    });

    it('should detect domain changes', () => {
      const previous = createGraph([
        createNode('app/page.tsx', 'component', 'UI', 'main'),
      ]);
      const current = createGraph([
        createNode('app/page.tsx', 'component', 'UI', 'risk'),
      ]);

      const result = detector.detect(current, previous);

      expect(result.modifiedNodes).toHaveLength(1);
      expect(result.modifiedNodes[0].changes).toContain('domain: main → risk');
    });

    it('should detect type changes', () => {
      const previous = createGraph([
        createNode('app/page.tsx', 'component'),
      ]);
      const current = createGraph([
        createNode('app/page.tsx', 'api'),
      ]);

      const result = detector.detect(current, previous);

      expect(result.modifiedNodes).toHaveLength(1);
      expect(result.modifiedNodes[0].changes).toContain('type: component → api');
    });

    it('should detect added edges', () => {
      const previous = createGraph([
        createNode('app/page.tsx', 'component'),
        createNode('lib/utils.ts', 'utility'),
      ]);
      const current = createGraph(
        [
          createNode('app/page.tsx', 'component'),
          createNode('lib/utils.ts', 'utility'),
        ],
        [createEdge('app/page.tsx', 'lib/utils.ts')]
      );

      const result = detector.detect(current, previous);

      expect(result.addedEdges).toHaveLength(1);
      expect(result.addedEdges[0].from).toBe('app/page.tsx');
      expect(result.addedEdges[0].to).toBe('lib/utils.ts');
    });

    it('should detect removed edges', () => {
      const previous = createGraph(
        [
          createNode('app/page.tsx', 'component'),
          createNode('lib/utils.ts', 'utility'),
        ],
        [createEdge('app/page.tsx', 'lib/utils.ts')]
      );
      const current = createGraph([
        createNode('app/page.tsx', 'component'),
        createNode('lib/utils.ts', 'utility'),
      ]);

      const result = detector.detect(current, previous);

      expect(result.removedEdges).toHaveLength(1);
      expect(result.removedEdges[0].from).toBe('app/page.tsx');
    });

    it('should calculate total changes correctly', () => {
      const previous = createGraph(
        [
          createNode('app/old.tsx', 'component'),
          createNode('app/page.tsx', 'component', 'UI'),
        ],
        [createEdge('app/page.tsx', 'app/old.tsx')]
      );
      const current = createGraph(
        [
          createNode('app/page.tsx', 'component', 'API'),
          createNode('app/new.tsx', 'component'),
        ],
        [createEdge('app/page.tsx', 'app/new.tsx')]
      );

      const result = detector.detect(current, previous);

      expect(result.addedNodes).toContain('app/new.tsx');
      expect(result.removedNodes).toContain('app/old.tsx');
      expect(result.modifiedNodes).toHaveLength(1);
      expect(result.addedEdges).toHaveLength(1);
      expect(result.removedEdges).toHaveLength(1);
      
      expect(result.summary.totalChanges).toBe(5);
    });

    it('should return empty changes for identical graphs', () => {
      const graph = createGraph([
        createNode('app/page.tsx', 'component', 'UI'),
      ]);

      const result = detector.detect(graph, graph);

      expect(result.addedNodes).toHaveLength(0);
      expect(result.removedNodes).toHaveLength(0);
      expect(result.modifiedNodes).toHaveLength(0);
      expect(result.addedEdges).toHaveLength(0);
      expect(result.removedEdges).toHaveLength(0);
      expect(result.summary.totalChanges).toBe(0);
    });
  });

  describe('saveGraphState and loadGraphState', () => {
    it('should save and load graph state', async () => {
      const nodes = [
        createNode('app/page.tsx', 'component', 'UI', 'main'),
        createNode('lib/utils.ts', 'utility', 'Processing'),
      ];
      const edges = [createEdge('app/page.tsx', 'lib/utils.ts')];
      const graph = createGraph(nodes, edges);

      const outputPath = path.join(testOutputDir, 'graph-state.json');
      await detector.saveGraphState(graph, outputPath);

      const loaded = await detector.loadGraphState(outputPath);

      expect(loaded).not.toBeNull();
      expect(loaded?.nodes.size).toBe(2);
      expect(loaded?.edges).toHaveLength(1);
    });

    it('should return null when loading non-existent file', async () => {
      const loaded = await detector.loadGraphState('./non-existent.json');
      expect(loaded).toBeNull();
    });
  });
});

// ─── ChangeHighlighter Tests ──────────────────────────────────────────────────

describe('ChangeHighlighter', () => {
  let highlighter: ChangeHighlighter;

  beforeEach(() => {
    highlighter = new ChangeHighlighter();
  });

  describe('highlight', () => {
    it('should add ADDED annotation to added nodes', () => {
      const mermaid = `graph TB
  app_page[Page]
  app_new[New]`;
      
      const changes: ChangeDetectionResult = {
        addedNodes: ['app_new'],  // Use sanitized node ID matching Mermaid
        removedNodes: [],
        modifiedNodes: [],
        addedEdges: [],
        removedEdges: [],
        summary: { totalChanges: 1, addedCount: 1, removedCount: 0, modifiedCount: 0 },
        comparedAt: new Date().toISOString(),
      };

      const result = highlighter.highlight(mermaid, changes);

      expect(result).toContain('%% ADDED');
    });

    it('should comment out removed nodes', () => {
      const mermaid = `graph TB
  app_page[Page]
  app_old[Old]`;
      
      const changes: ChangeDetectionResult = {
        addedNodes: [],
        removedNodes: ['app_old'],  // Use sanitized node ID matching Mermaid
        modifiedNodes: [],
        addedEdges: [],
        removedEdges: [],
        summary: { totalChanges: 1, addedCount: 0, removedCount: 1, modifiedCount: 0 },
        comparedAt: new Date().toISOString(),
      };

      const result = highlighter.highlight(mermaid, changes);

      expect(result).toContain('%% REMOVED:');
    });

    it('should add MODIFIED annotation to modified nodes', () => {
      const mermaid = `graph TB
  app_page[Page]`;
      
      const changes: ChangeDetectionResult = {
        addedNodes: [],
        removedNodes: [],
        modifiedNodes: [{
          nodeId: 'app_page',  // Use sanitized node ID matching Mermaid
          previous: { layer: 'UI' },
          current: { layer: 'API' },
          changes: ['layer: UI → API'],
        }],
        addedEdges: [],
        removedEdges: [],
        summary: { totalChanges: 1, addedCount: 0, removedCount: 0, modifiedCount: 1 },
        comparedAt: new Date().toISOString(),
      };

      const result = highlighter.highlight(mermaid, changes);

      expect(result).toContain('%% MODIFIED');
    });

    it('should add change summary header when changes exist', () => {
      const mermaid = 'graph TB\n  A --> B';
      
      const changes: ChangeDetectionResult = {
        addedNodes: ['new'],
        removedNodes: [],
        modifiedNodes: [],
        addedEdges: [],
        removedEdges: [],
        summary: { totalChanges: 1, addedCount: 1, removedCount: 0, modifiedCount: 0 },
        comparedAt: new Date().toISOString(),
      };

      const result = highlighter.highlight(mermaid, changes);

      expect(result).toContain('%% === Architecture Changes ===');
      expect(result).toContain('%% Added: 1');
    });

    it('should not add header when no changes', () => {
      const mermaid = 'graph TB\n  A --> B';
      
      const changes: ChangeDetectionResult = {
        addedNodes: [],
        removedNodes: [],
        modifiedNodes: [],
        addedEdges: [],
        removedEdges: [],
        summary: { totalChanges: 0, addedCount: 0, removedCount: 0, modifiedCount: 0 },
        comparedAt: new Date().toISOString(),
      };

      const result = highlighter.highlight(mermaid, changes);

      expect(result).not.toContain('Architecture Changes');
    });
  });
});
