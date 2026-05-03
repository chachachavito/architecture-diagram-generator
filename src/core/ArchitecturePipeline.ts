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
import { ArchitectureAnalyzer } from '../analyzer/ArchitectureAnalyzer';
import { AnalysisHistory } from '../analyzer/AnalysisHistory';
import { parseAnalyzerConfig, DEFAULT_ANALYZER_CONFIG } from '../analyzer/AnalyzerConfig';
import type { AnalyzerConfig } from '../analyzer/AnalyzerConfig';
import type { AnalysisResult } from '../analyzer/types';
import * as path from 'path';
import * as fs from 'fs/promises';
import { execSync } from 'child_process';

const ANALYZER_CONFIG_FILES = [
  'architecture-analyzer.json',
  '.architecture-analyzer.json',
  '.architecturerc.json',
];

export interface PipelineOptions {
  version: string;
  config: ProjectConfig;
  debug?: boolean;
  analysisScope?: string[];
  disabledRules?: string[];
  includeTimestamp?: boolean;
  rootDir: string;
  outputBase?: string;
  analyzerConfig?: AnalyzerConfig;
  /** When true, detect changed files via git and focus analysis on them. */
  changedOnly?: boolean;
}

/**
 * ArchitecturePipeline orchestrates the architectural parsing and graph generation flow.
 */
export class ArchitecturePipeline {
  private normalizer = new Normalizer();
  private classifier = new ArchitectureClassifier();
  private analyzerConfig: AnalyzerConfig;

  constructor(private options: PipelineOptions) {
    this.analyzerConfig = options.analyzerConfig ?? DEFAULT_ANALYZER_CONFIG;
  }

  /**
   * Discovers files, parses them, builds the graph and runs the full pipeline.
   */
  async runFull(projectRoot: string): Promise<{ 
    graph: ClassifiedGraph, 
    version: string,
    analysis?: AnalysisResult
  }> {
    const absProjectRoot = path.resolve(projectRoot);
    
    // 0. Load analyzer config from file if not provided
    if (!this.options.analyzerConfig) {
      this.analyzerConfig = await this.loadAnalyzerConfig(absProjectRoot);
    }

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

    // 5. Run Architecture Analysis
    this.log('Stage 4: Running architecture analysis...');
    const analyzer = new ArchitectureAnalyzer(this.analyzerConfig);
    
    // If changedOnly, filter analysis scope to changed files
    let analysisGraph = graph as ClassifiedGraph;
    if (this.options.changedOnly) {
      const changedFiles = this.getChangedFiles(absProjectRoot);
      if (changedFiles.length > 0) {
        this.log(`   Changed files mode: ${changedFiles.length} files`);
        const changedSet = new Set(changedFiles.map(f => path.relative(absProjectRoot, path.resolve(absProjectRoot, f))));
        // Filter nodes but keep full edge set for accurate coupling analysis
        const filteredNodes = analysisGraph.nodes.filter(n => {
          const relPath = n.id;
          return changedSet.has(relPath) || changedSet.has(relPath.replace(/^src\//, ''));
        });
        if (filteredNodes.length > 0) {
          const filteredIds = new Set(filteredNodes.map(n => n.id));
          analysisGraph = {
            ...analysisGraph,
            nodes: filteredNodes,
            edges: analysisGraph.edges.filter(e => filteredIds.has(e.from) || filteredIds.has(e.to)),
          };
        } else {
          this.log('   No matching nodes found, falling back to full analysis');
        }
      }
    }
    
    const analysis = analyzer.run(analysisGraph);
    this.log(`   Score: ${analysis.score}/100 | Issues: ${analysis.summary.totalIssues}`);

    // 5.1 Save history snapshot
    const historyConfig = this.analyzerConfig.history;
    if (historyConfig?.enabled !== false) {
      try {
        const history = new AnalysisHistory(
          absProjectRoot,
          historyConfig?.directory,
          historyConfig?.maxEntries,
        );
        const filepath = await history.save(analysis);
        this.log(`   History saved: ${path.basename(filepath)}`);
      } catch (err) {
        this.log(`   History save failed: ${err}`);
      }
    }

    // 6. Generate and Save Outputs
    if (this.options.outputBase) {
      await this.saveOutputs(graph, this.options.outputBase, analysis);
    }

    return { ...result, analysis };
  }

  /**
   * Load analyzer config from project root.
   */
  private async loadAnalyzerConfig(projectRoot: string): Promise<AnalyzerConfig> {
    for (const filename of ANALYZER_CONFIG_FILES) {
      const filepath = path.join(projectRoot, filename);
      try {
        const content = await fs.readFile(filepath, 'utf-8');
        const raw = JSON.parse(content);
        const config = parseAnalyzerConfig(raw);
        this.log(`   Loaded analyzer config: ${filename}`);
        return config;
      } catch {
        // File doesn't exist or is invalid, try next
      }
    }
    this.log('   Using default analyzer config');
    return DEFAULT_ANALYZER_CONFIG;
  }

  /**
   * Generates and saves all output files (JSON, Markdown, HTML).
   */
  private async saveOutputs(graph: ClassifiedGraph, outputBase: string, analysis?: AnalysisResult): Promise<void> {
    this.log('Stage 6: Saving output files...');
    
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
      graph,
      analysis: analysis ? {
        score: analysis.score,
        issues: analysis.issues,
        metrics: analysis.metrics,
        summary: analysis.summary,
      } : undefined,
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
    const report = analysis ? {
      issues: analysis.issues,
      score: analysis.score,
      summary: analysis.summary,
      suggestions: analysis.suggestions || [],
    } : undefined;
    const htmlContent = htmlGenerator.generate(graph, projectName, report);
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

  /**
   * Detect changed files via git diff (staged + unstaged).
   */
  private getChangedFiles(projectRoot: string): string[] {
    try {
      const output = execSync('git diff --name-only HEAD 2>/dev/null || git diff --name-only --cached 2>/dev/null || echo ""', {
        cwd: projectRoot,
        encoding: 'utf-8',
        timeout: 5000,
      });
      return output
        .split('\n')
        .map(f => f.trim())
        .filter(f => f.length > 0 && /\.(ts|tsx|js|jsx)$/.test(f));
    } catch {
      this.log('   Git diff not available, using full analysis');
      return [];
    }
  }
}
