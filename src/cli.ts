#!/usr/bin/env node

/**
 * Architecture Diagram Generator CLI
 * Entry point for the command-line interface
 */

import path from 'path';
import fs from 'fs/promises';
import { FileDiscovery, ProjectConfig, DependencyGraphBuilder, ArchitectureFilter, ModuleCache, ParallelFileProcessor, PluginManager, ConfigurationLoader, type Plugin, type FullProjectConfig } from './core';
import { ASTParser, ParsedModule } from './parsers';
import { DiagramGenerator } from './generators';
import { VisualExporter } from './generators/VisualExporter';
import { OutputWriter, Logger, LogLevel, GeneratorError, NoFilesFoundError, InvalidProjectRootError } from './utils';
import { createAIDocumentationPlugin } from './plugins';

/**
 * CLI options interface
 */
interface CLIOptions {
  projectRoot: string;
  outputPath: string;
  outputDir: string;
  ignore: string[];
  maxNodes: number;
  grouping: boolean;
  mode: 'architecture' | 'full';
  formats: ('markdown' | 'png' | 'svg')[];
  simplified: boolean;
  detailed: boolean;
  help: boolean;
}

/**
 * Parses command line arguments
 */
function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    projectRoot: process.cwd(),
    outputPath: '',
    outputDir: '',
    ignore: [],
    maxNodes: 150,
    grouping: true,
    mode: 'architecture',
    formats: ['markdown'],
    simplified: false,
    detailed: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--ignore':
        if (i + 1 < args.length) {
          options.ignore = args[++i].split(',').map(p => p.trim());
        }
        break;
      case '--max-nodes':
        if (i + 1 < args.length) {
          options.maxNodes = parseInt(args[++i], 10) || 150;
        }
        break;
      case '--no-grouping':
        options.grouping = false;
        break;
      case '--mode':
        if (i + 1 < args.length) {
          const m = args[++i];
          if (m === 'full' || m === 'architecture') {
            options.mode = m;
          } else {
            console.warn(`⚠️  Unknown mode "${m}", using "architecture"`);
          }
        }
        break;
      case '--output':
      case '-o':
        if (i + 1 < args.length) {
          options.outputPath = args[++i];
        }
        break;
      case '--output-dir':
        if (i + 1 < args.length) {
          options.outputDir = args[++i];
        }
        break;
      case '--markdown':
        if (!options.formats.includes('markdown')) {
          options.formats.push('markdown');
        }
        break;
      case '--png':
        if (!options.formats.includes('png')) {
          options.formats.push('png');
        }
        break;
      case '--svg':
        if (!options.formats.includes('svg')) {
          options.formats.push('svg');
        }
        break;
      case '--format':
        if (i + 1 < args.length) {
          const requestedFormats = args[++i].split(',').map(f => f.trim().toLowerCase());
          // Clear defaults if --format is explicitly used
          options.formats = [];
          for (const f of requestedFormats) {
            if (f === 'md' || f === 'markdown') {
              if (!options.formats.includes('markdown')) options.formats.push('markdown');
            } else if (f === 'png') {
              if (!options.formats.includes('png')) options.formats.push('png');
            } else if (f === 'svg') {
              if (!options.formats.includes('svg')) options.formats.push('svg');
            } else {
              console.warn(`⚠️  Unknown format "${f}", skipping`);
            }
          }
          // If all provided formats were invalid, fall back to markdown
          if (options.formats.length === 0) options.formats = ['markdown'];
        }
        break;
      case '--simplified':
        options.simplified = true;
        break;
      case '--detailed':
        options.detailed = true;
        break;
      default:
        // First non-flag argument is project root
        if (!arg.startsWith('-') && options.projectRoot === process.cwd()) {
          options.projectRoot = path.resolve(arg);
        }
        break;
    }
  }

  // Set default output path if not specified
  if (!options.outputPath && !options.outputDir) {
    options.outputPath = path.join(options.projectRoot, 'architecture.md');
  } else if (options.outputPath && !path.isAbsolute(options.outputPath)) {
    // Resolve relative output paths against cwd, not project root
    options.outputPath = path.resolve(process.cwd(), options.outputPath);
  } else if (options.outputDir && !path.isAbsolute(options.outputDir)) {
    options.outputDir = path.resolve(process.cwd(), options.outputDir);
  }

  // If no specific diagram types selected, generate both
  if (!options.simplified && !options.detailed) {
    options.detailed = true;
  }

  return options;
}

/**
 * Shows help information
 */
function showHelp(): void {
  console.log(`
🏗️  Architecture Diagram Generator

USAGE:
  architecture-generator [project-root] [options]

OPTIONS:
  --output, -o <path>     Output file path (default: architecture.md)
  --output-dir <path>     Output directory for multiple formats
  --ignore <patterns>     Comma-separated ignore patterns
  --max-nodes <number>    Maximum number of nodes (default: 150)
  --no-grouping          Disable layer grouping
  --mode <mode>          Output mode: "architecture" (filtered, ~40 nodes) or "full" (default: architecture)
  
  FORMAT OPTIONS:
  --format <formats>     Comma-separated formats: md, png, svg (default: md)
  --markdown             Generate Markdown output
  --png                  Generate PNG image output (requires Puppeteer)
  --svg                  Generate SVG image output (requires Mermaid CLI)
  
  DIAGRAM TYPE OPTIONS:
  --simplified           Generate simplified diagram (aggregated by domain)
  --detailed             Generate detailed diagram (all modules)
  
  --help, -h             Show this help message

EXAMPLES:
  architecture-generator
  architecture-generator ./my-project
  architecture-generator --format md,png
  architecture-generator --format svg --output-dir ./docs
  architecture-generator --simplified --detailed --output-dir ./docs
  architecture-generator --ignore "**/*.test.*,**/temp/**" --max-nodes 30
  architecture-generator ./project --output ./docs/arch.md --no-grouping
`);
}

/**
 * Main CLI function that orchestrates the entire pipeline
 */
async function main(): Promise<void> {
  const logger = new Logger(LogLevel.INFO);
  
  try {
    const options = parseArgs();

    if (options.help) {
      showHelp();
      process.exit(0);
    }

    logger.section('Architecture Diagram Generator');
    logger.subsection(`Project root: ${options.projectRoot}`);
    logger.subsection(`Output file: ${options.outputPath}`);
    if (options.ignore.length > 0) {
      logger.subsection(`Ignore patterns: ${options.ignore.join(', ')}`);
    }
    logger.subsection(`Max nodes: ${options.maxNodes}`);
    logger.subsection(`Layer grouping: ${options.grouping ? 'enabled' : 'disabled'}`);
    logger.subsection(`Mode: ${options.mode}`);

    // Verify project root exists
    try {
      await fs.access(options.projectRoot);
    } catch {
      throw new InvalidProjectRootError(options.projectRoot);
    }

    // Initialize Plugin Manager and load configuration
    const configLoader = new ConfigurationLoader();
    let fullConfig: FullProjectConfig;
    
    try {
      const configPath = path.join(options.projectRoot, 'architecture-config.json');
      fullConfig = await configLoader.load(configPath);
    } catch {
      // Use default config if no config file found
      fullConfig = {
        rootDir: options.projectRoot,
        include: ['app/**', 'pages/**', 'src/**', 'lib/**'],
        exclude: [],
        layers: [],
        domains: [],
        externalServices: [],
        output: {
          formats: ['markdown'],
          directory: './docs',
          simplified: true,
          detailed: false,
        },
        plugins: [],
      };
    }

    // Initialize plugin manager
    const pluginManager = new PluginManager();
    
    // Register built-in plugins from configuration
    const pluginFactories = new Map<string, (config?: Record<string, unknown>) => Plugin>([
      ['ai-documentation-enhancer', createAIDocumentationPlugin],
    ]);
    
    if (fullConfig.plugins.length > 0) {
      pluginManager.registerFromConfig(fullConfig.plugins, pluginFactories);
      logger.subsection(`Plugins loaded: ${pluginManager.getAllPlugins().length}`);
    }

    // Execute beforeDiscovery hook
    await pluginManager.execute('beforeDiscovery', fullConfig);

    // Step 1: File Discovery
    logger.section('File Discovery');
    const fileDiscovery = new FileDiscovery();
    const config: ProjectConfig = {
      rootDir: options.projectRoot,
      exclude: [
        '**/node_modules/**', 
        '**/.next/**', 
        '**/dist/**', 
        '**/build/**',
        '**/coverage/**',
        '**/.vercel/**',
        '**/.git/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/*.stories.*',
        ...options.ignore
      ],
    };
    
    const fileList = await fileDiscovery.discover(options.projectRoot, config);
    const totalFiles = 
      fileList.routes.length + 
      fileList.api.length + 
      fileList.components.length + 
      fileList.utilities.length +
      (fileList.config?.length || 0);
    
    logger.logDiscoveryProgress(
      fileList.routes.length,
      fileList.api.length,
      fileList.components.length,
      fileList.utilities.length,
      fileList.config?.length || 0
    );

    // Step 2: Parse AST
    logger.section('File Parsing');
    const parser = new ASTParser(options.projectRoot);
    const allFiles = [
      ...fileList.routes,
      ...fileList.api,
      ...fileList.components,
      ...fileList.utilities,
      ...(fileList.config || []),
    ];

    if (allFiles.length === 0) {
      throw new NoFilesFoundError(options.projectRoot);
    }

    // Initialize cache for parsed modules
    const cache = new ModuleCache();

    // Use parallel file processor for concurrent parsing
    const processor = new ParallelFileProcessor(options.projectRoot, {
      concurrency: 4,  // Process 4 files concurrently
      cache,
    });

    const processingResult = await processor.processFiles(allFiles);
    const parsedModules = processingResult.successful;

    // Log cache statistics
    const cacheStats = processor.getCacheStats();
    logger.logParsingProgress(
      parsedModules.length,
      processingResult.failed.length,
      processingResult.duration,
      cacheStats?.hits,
      cacheStats?.misses
    );

    // Log parse errors if any
    if (processingResult.failed.length > 0) {
      logger.logParseErrors(processingResult.failed);
    }

    // Execute afterParsing hook
    await pluginManager.execute('afterParsing', parsedModules);

    // Step 3: Build Dependency Graph and Generate Diagram
    logger.section('Dependency Graph');
    const graphBuilder = new DependencyGraphBuilder(options.projectRoot);
    const fullGraph = graphBuilder.build(parsedModules);

    logger.logGraphProgress(
      fullGraph.nodes.size,
      fullGraph.edges.length,
      [...fullGraph.nodes.values()].filter(n => n.type === 'external-service').length
    );

    // Execute beforeClassification hook
    await pluginManager.execute('beforeClassification', fullGraph);

    logger.section('Diagram Generation');
    const generator = new DiagramGenerator();
    const generationOptions = {
      direction: 'LR' as const,
      showDependencies: true,
      groupByLayer: options.grouping,
      maxNodes: options.maxNodes,
    };

    let graph: InstanceType<typeof import('./core').DependencyGraph>;
    let mode: string;

    if (options.mode === 'architecture') {
      // Architecture mode: filter, rename, domain-group, limit to ~40 nodes
      const filter = new ArchitectureFilter();
      const { graph: filteredGraph, coreNodes } = filter.filter(fullGraph);
      graph = filteredGraph;
      mode = `architecture (filtered, ${coreNodes.size} core nodes)`;
    } else {
      // Full mode: apply node limit by priority, include external-service nodes
      const priorityOrder: Record<string, number> = { api: 4, route: 3, component: 2, utility: 1, config: 0, 'external-service': -1 };
      const internalEntries = [...fullGraph.nodes.entries()].filter(([, n]) => n.type !== 'external-service');
      const sortedEntries = internalEntries.sort(([, a], [, b]) => (priorityOrder[b.type] ?? 0) - (priorityOrder[a.type] ?? 0));
      const limitedEntries = options.maxNodes ? sortedEntries.slice(0, options.maxNodes) : sortedEntries;
      const limitedNodeIds = new Set(limitedEntries.map(([id]) => id));

      // Only include external-service nodes that were detected via actual external calls
      // (fetch/axios/database), not npm package imports. These have a 'layer' set.
      const externalEntries = [...fullGraph.nodes.entries()].filter(
        ([, n]) => n.type === 'external-service' && n.layer !== undefined
      );

      const { DependencyGraph: DG } = await import('./core');
      graph = new DG();
      for (const [, node] of limitedEntries) {
        graph.addNode(node);
      }
      // Add external-service nodes
      for (const [, node] of externalEntries) {
        graph.addNode(node);
      }
      const externalNodeIds = new Set(externalEntries.map(([id]) => id));
      for (const edge of fullGraph.edges) {
        if (edge.type === 'import' && limitedNodeIds.has(edge.from) && limitedNodeIds.has(edge.to)) {
          graph.addEdge(edge);
        } else if (edge.type === 'external-call' && limitedNodeIds.has(edge.from) && externalNodeIds.has(edge.to)) {
          graph.addEdge(edge);
        }
      }
      mode = 'full';
    }

    // Execute afterClassification hook with the processed graph
    await pluginManager.execute('afterClassification', graph as any);

    // Generate diagrams based on selected types
    const diagrams: { type: 'simplified' | 'detailed'; diagram: ReturnType<typeof generator.generate> }[] = [];
    
    // Execute beforeGeneration hook
    await pluginManager.execute('beforeGeneration', graph as any);
    
    if (options.detailed) {
      const detailedDiagram = generator.generateDetailed(graph, generationOptions);
      diagrams.push({ type: 'detailed', diagram: detailedDiagram });
      logger.logDiagramProgress(`${mode} (detailed)`, detailedDiagram.metadata.nodeCount, detailedDiagram.metadata.edgeCount);
      
      // Execute afterGeneration hook for detailed diagram
      await pluginManager.execute('afterGeneration', detailedDiagram);
    }
    
    if (options.simplified) {
      const simplifiedDiagram = generator.generateSimplified(graph, generationOptions);
      diagrams.push({ type: 'simplified', diagram: simplifiedDiagram });
      logger.logDiagramProgress(`${mode} (simplified)`, simplifiedDiagram.metadata.nodeCount, simplifiedDiagram.metadata.edgeCount);
      
      // Execute afterGeneration hook for simplified diagram
      await pluginManager.execute('afterGeneration', simplifiedDiagram);
    }

    // Step 4: Write Output
    logger.section('Output');
    const writer = new OutputWriter();
    const exporter = new VisualExporter();
    
    // Determine output directory
    const outputDir = options.outputDir || (options.outputPath ? path.dirname(options.outputPath) : path.join(options.projectRoot, 'docs'));
    
    // Ensure output directory exists
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch {
      // Directory might already exist
    }

    // Generate outputs for each diagram type and format
    for (const { type, diagram } of diagrams) {
      const baseName = type === 'simplified' ? 'architecture-simplified' : 'architecture';
      
      // Markdown output
      if (options.formats.includes('markdown')) {
        const mdPath = path.join(outputDir, `${baseName}.md`);
        await writer.write(diagram, mdPath);
        logger.logOutputProgress(mdPath);
      }
      
      // PNG output
      if (options.formats.includes('png')) {
        const pngPath = path.join(outputDir, `${baseName}.png`);
        try {
          await exporter.export(diagram, 'png', pngPath);
          logger.logOutputProgress(pngPath);
        } catch (error) {
          logger.warn(`Failed to generate PNG: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      // SVG output
      if (options.formats.includes('svg')) {
        const svgPath = path.join(outputDir, `${baseName}.svg`);
        try {
          await exporter.export(diagram, 'svg', svgPath);
          logger.logOutputProgress(svgPath);
        } catch (error) {
          logger.warn(`Failed to generate SVG: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // Summary
    logger.logSummary();

    process.exit(0);
  } catch (error) {
    console.error('');
    
    if (error instanceof GeneratorError) {
      console.error(`❌ ${error.getFormattedMessage()}`);
    } else if (error instanceof Error) {
      console.error(`❌ Error: ${error.message}`);
    } else {
      console.error(`❌ Error: ${String(error)}`);
    }
    
    if (error instanceof Error && error.stack) {
      console.error('');
      console.error('Stack trace:');
      console.error(error.stack);
    }
    
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('   - Ensure the project root directory exists and is accessible');
    console.error('   - Check that the project contains TypeScript/JavaScript files');
    console.error('   - Verify file permissions for reading and writing');
    console.error('   - Use --help for usage information');
    
    process.exit(1);
  }
}

main();
