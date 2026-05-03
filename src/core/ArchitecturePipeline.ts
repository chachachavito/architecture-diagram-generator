import { 
  SourceGraph, 
  ClassifiedGraph, 
  GraphSnapshot
} from './GraphTypes';
import { Normalizer } from './Normalizer';
import { ArchitectureClassifier } from './ArchitectureClassifier';
import { ProjectConfig } from './ConfigValidator';
import { FileDiscovery } from './FileDiscovery';
import { ASTParser } from '../parsers/ASTParser';
import { DependencyGraphBuilder } from './DependencyGraphBuilder';
import { DiagramGenerator } from '../generators/DiagramGenerator';
import { HTMLGenerator } from '../generators/HTMLGenerator';
import { SVGRenderer } from '../generators/SVGRenderer';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface PipelineOptions {
  version: string;
  config: ProjectConfig;
  debug?: boolean;
  analysisScope?: string[];
  disabledRules?: string[];
  includeTimestamp?: boolean;
  rootDir: string;
  outputBase?: string;
}

/**
 * ArchitecturePipeline orchestrates the architectural parsing and graph generation flow.
 */
export class ArchitecturePipeline {
  private normalizer = new Normalizer();
  private classifier = new ArchitectureClassifier();
  constructor(private options: PipelineOptions) {}

  /**
   * Discovers files, parses them, builds the graph and runs the full pipeline.
   */
  async runFull(projectRoot: string): Promise<{ 
    graph: ClassifiedGraph, 
    version: string 
  }> {
    const absProjectRoot = path.resolve(projectRoot);
    
    // 1. File Discovery
    this.log('Stage 1: Discovering files...');
    const discovery = new FileDiscovery();
    const fileList = await discovery.discover(absProjectRoot, { rootDir: absProjectRoot });
    
    const allFiles = [
      ...fileList.routes,
      ...fileList.api,
      ...fileList.components,
      ...fileList.utilities,
      ...(fileList.config || [])
    ];

    // 2. Parse AST
    this.log(`Stage 2: Parsing ${allFiles.length} files...`);
    const parser = new ASTParser(absProjectRoot);
    const parsedModules = [];
    for (const file of allFiles) {
      try {
        const module = await parser.parse(file);
        parsedModules.push(module);
      } catch {
        if (this.options.debug) {
          console.error(`   Warning: Failed to parse ${file}`);
        }
      }
    }

    // 3. Build Dependency Graph
    this.log('Stage 3: Building dependency graph...');
    const builder = new DependencyGraphBuilder();
    const sourceGraph = builder.build(parsedModules);

    // 4. Run Pipeline (Normalize, Classify, etc.)
    const result = await this.run(sourceGraph);
    const graph = result.graph;

    // 5. Generate and Save Outputs
    if (this.options.outputBase) {
      await this.saveOutputs(graph, this.options.outputBase);
    }

    return result;
  }

  /**
   * Generates and saves all output files (JSON, Markdown, HTML).
   */
  private async saveOutputs(graph: ClassifiedGraph, outputBase: string): Promise<void> {
    this.log('Stage 5: Saving output files...');
    
    // Resolve output paths
    const absOutputPath = path.isAbsolute(outputBase) 
      ? outputBase 
      : path.join(this.options.rootDir, outputBase);
    
    const outputDir = path.dirname(absOutputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // 1. JSON Data
    const output = {
      version: this.options.version,
      generatedAt: new Date().toISOString(),
      graph
    };
    await fs.writeFile(absOutputPath, JSON.stringify(output, null, 2));
    this.log(`   - Data: ${path.basename(absOutputPath)}`);

    // 2. Markdown (Mermaid)
    const generator = new DiagramGenerator();
    const diagram = generator.generate(graph);
    const mdPath = absOutputPath.replace('.json', '.md');
    await fs.writeFile(mdPath, `# Architecture Diagram\n\n\`\`\`mermaid\n${diagram.syntax}\n\`\`\``);
    this.log(`   - Markdown: ${path.basename(mdPath)}`);

    // 3. HTML Dashboard
    const projectName = path.basename(this.options.rootDir);
    const htmlGenerator = new HTMLGenerator();
    const htmlContent = htmlGenerator.generate(graph, projectName);
    const htmlPath = absOutputPath.replace('.json', '.html');
    await fs.writeFile(htmlPath, htmlContent);
    this.log(`   - Dashboard: ${path.basename(htmlPath)}`);

    // 4. SVG (Interactive)
    const svgGenerator = new SVGRenderer();
    const svgResult = svgGenerator.render(graph as unknown as any);
    const svgPath = absOutputPath.replace('.json', '.svg');
    const fullSvg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
      <style>${svgResult.css}</style>
      ${svgResult.html}`;
    await fs.writeFile(svgPath, fullSvg);
    this.log(`   - SVG: ${path.basename(svgPath)}`);
  }

  /**
   * Runs the pipeline to generate a classified graph.
   */
  async run(input: SourceGraph): Promise<{ 
    graph: ClassifiedGraph, 
    version: string 
  }> {
    this.log('Starting pipeline...');

    // 1. Validate
    this.validate(input);

    // 2. Normalize
    this.log('Stage: Normalize');
    const normalized = this.normalizer.normalize(input, this.options.rootDir);

    // 3. Classify
    this.log('Stage: Classify');
    this.classifier.classify(normalized.nodes, this.options.config);
    const classified: ClassifiedGraph = {
      ...normalized,
      version: this.options.version
    };

    // 4. Enrich
    this.log('Stage: Enrich');

    // 5. Sanitize
    this.log('Stage: Sanitize');
    const sanitized = this.sanitize(classified);

    // 6. Snapshot
    this.log('Stage: Snapshot');
    const snapshot = this.createSnapshot(sanitized);

    this.log('Pipeline completed.');

    return {
      graph: snapshot,
      version: this.options.version
    };
  }

  private validate(graph: SourceGraph): void {
    if (!graph.nodes || !graph.edges) {
      throw new Error('Invalid SourceGraph: missing nodes or edges');
    }
    
    const ids = new Set();
    for (const node of graph.nodes) {
      if (ids.has(node.id)) {
        throw new Error(`Duplicate NodeId detected: ${node.id}`);
      }
      ids.add(node.id);
    }

    for (const edge of graph.edges) {
      if (!ids.has(edge.from)) {
        throw new Error(`Invalid edge: source node ${edge.from} not found`);
      }
    }
  }

  private sanitize(graph: ClassifiedGraph): ClassifiedGraph {
    return JSON.parse(JSON.stringify(graph));
  }

  private createSnapshot(graph: ClassifiedGraph): GraphSnapshot {
    graph.nodes.sort((a, b) => a.id.localeCompare(b.id));
    graph.edges.sort((a, b) => {
      const fromCmp = a.from.localeCompare(b.from);
      if (fromCmp !== 0) return fromCmp;
      return a.to.localeCompare(b.to);
    });

    return this.deepFreeze(graph);
  }

  private deepFreeze<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    const propNames = Object.getOwnPropertyNames(obj);
    for (const name of propNames) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = (obj as any)[name];
      if (value && typeof value === 'object') {
        this.deepFreeze(value);
      }
    }
    return Object.freeze(obj);
  }

  private log(message: string): void {
    if (this.options.debug) {
      console.error(`[DEBUG] [Pipeline] ${message}`);
    }
  }
}
