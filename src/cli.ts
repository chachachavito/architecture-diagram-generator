#!/usr/bin/env node

/**
 * Architecture Diagram Generator CLI
 */

import path from 'path';
import fs from 'fs/promises';
import { 
  FileDiscovery, 
  DependencyGraphBuilder, 
  ArchitecturePipeline, 
  validateConfig,
} from './core';
import { ASTParser } from './parsers';
import { DiagramGenerator, HTMLGenerator } from './generators';
import { Logger, LogLevel, NoFilesFoundError } from './utils';

interface CLIOptions {
  projectRoot: string;
  outputPath: string;
  debug: boolean;
  version: boolean;
  help: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    projectRoot: process.cwd(),
    outputPath: '',
    debug: false,
    version: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--help': case '-h': options.help = true; break;
      case '--version': case '-v': options.version = true; break;
      case '--debug': options.debug = true; break;
      case '--output': case '-o': if (i + 1 < args.length) options.outputPath = args[++i]; break;
      default:
        if (!arg.startsWith('-') && options.projectRoot === process.cwd()) {
          options.projectRoot = path.resolve(arg);
        }
        break;
    }
  }

  if (!options.outputPath) {
    options.outputPath = path.join(options.projectRoot, 'architecture.json');
  }

  return options;
}

async function main(): Promise<void> {
  const logger = new Logger(LogLevel.INFO);
  
  try {
    const options = parseArgs();

    if (options.help) {
      console.log(`
Architecture Diagram Generator (v0.4.3)

Usage: architecture-generator [project-root] [options]

Options:
  --output, -o    Path to save the generated files (default: [root]/architecture.json)
  --debug         Enable verbose logging
  --version, -v   Show version number
  --help, -h      Show this help message

Description:
  Scans a modern TypeScript project and generates an architectural graph (graph.json)
  and a structural Mermaid diagram. Analysis has been moved to architecture-analyzer.
      `);
      process.exit(0);
    }

    if (options.version) {
      try {
        const pkg = JSON.parse(await fs.readFile(path.join(__dirname, '../package.json'), 'utf-8'));
        console.log(`v${pkg.version}`);
      } catch (e) {
        console.log('v0.4.3');
      }
      process.exit(0);
    }

    // Load config
    const configPath = path.join(options.projectRoot, 'architecture-config.json');
    let rawConfig = {};
    try {
      rawConfig = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    } catch (e) {}
    const config = validateConfig(rawConfig);

    console.log(`\n🔍 Analyzing project at: ${options.projectRoot}`);

    // 1. Discovery
    console.log('📂 Step 1: Scanning for files...');
    const discovery = new FileDiscovery();
    const fileList = await discovery.discover(options.projectRoot, {
      rootDir: options.projectRoot,
      exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**']
    });

    const allFiles = [
      ...fileList.routes,
      ...fileList.api,
      ...fileList.components,
      ...fileList.utilities,
      ...(fileList.config || []),
    ];

    if (allFiles.length === 0) throw new NoFilesFoundError(options.projectRoot);
    console.log(`✅ Found ${allFiles.length} relevant files.`);

    // 2. Parse
    console.log('🏗️  Step 2: Parsing AST and extracting metadata...');
    const parser = new ASTParser(options.projectRoot);
    const parsedModules = [];
    for (const file of allFiles) {
      try {
        const parsed = await parser.parse(file);
        parsedModules.push(parsed);
      } catch (e) {
        if (options.debug) console.error(`Failed to parse ${file}:`, e);
      }
    }

    // 3. Build Source Graph
    console.log('🕸️  Step 3: Building dependency graph...');
    const builder = new DependencyGraphBuilder(options.projectRoot);
    const sourceGraph = builder.build(parsedModules);

    // 4. Run Pipeline
    console.log('🚀 Step 4: Normalizing architecture and applying rules...');
    const pipeline = new ArchitecturePipeline({
      version: '0.4.3',
      config,
      debug: options.debug,
      rootDir: options.projectRoot
    });

    const { graph } = await pipeline.run(sourceGraph);
    console.log(`✅ Graph built with ${graph.nodes.length} nodes and ${graph.edges.length} edges.`);

    // 5. Generate Diagram
    console.log('🎨 Step 5: Generating interactive diagrams...');
    const generator = new DiagramGenerator();
    const diagram = generator.generate(graph);

    // 6. Write Output
    console.log('💾 Step 6: Saving output files...');
    const output = {
      version: '0.4.3',
      generatedAt: new Date().toISOString(),
      graph
    };

    await fs.writeFile(options.outputPath, JSON.stringify(output, null, 2));
    
    const mdPath = options.outputPath.replace('.json', '.md');
    await fs.writeFile(mdPath, `# Architecture Diagram\n\n\`\`\`mermaid\n${diagram.syntax}\n\`\`\``);

    const projectName = path.basename(options.projectRoot);
    const htmlGenerator = new HTMLGenerator();
    const htmlContent = htmlGenerator.generate(graph, projectName);
    const htmlPath = options.outputPath.replace('.json', '.html');
    await fs.writeFile(htmlPath, htmlContent);

    console.log(`\n🚀 Generation successful!`);
    console.log(`   - Data: ${path.basename(options.outputPath)}`);
    console.log(`   - Markdown: ${path.basename(mdPath)}`);
    console.log(`   - Dashboard: ${path.basename(htmlPath)} (OPEN THIS IN BROWSER)`);

    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
