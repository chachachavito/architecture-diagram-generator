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
  ConfigValidator, 
  validateConfig,
  type ProjectConfig 
} from './core';
import { ASTParser } from './parsers';
import { DiagramGenerator } from './generators';
import { OutputWriter, Logger, LogLevel, GeneratorError, NoFilesFoundError, InvalidProjectRootError } from './utils';
import dotenv from 'dotenv';

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
      console.log('Usage: architecture-generator [project-root] [options]');
      process.exit(0);
    }

    if (options.version) {
      try {
        const pkg = JSON.parse(await fs.readFile(path.join(__dirname, '../package.json'), 'utf-8'));
        console.log(`v${pkg.version}`);
      } catch (e) {
        console.log('v0.2.1');
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

    // 1. Discovery
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

    // 2. Parse
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
    const builder = new DependencyGraphBuilder(options.projectRoot);
    const sourceGraph = builder.build(parsedModules);

    // 4. Run Pipeline
    const pipeline = new ArchitecturePipeline({
      version: '2.0.0',
      config,
      debug: options.debug,
      rootDir: options.projectRoot
    });

    const { graph, report } = await pipeline.run(sourceGraph);

    // 5. Generate Diagram
    const generator = new DiagramGenerator();
    const diagram = generator.generate(graph, report);
    await pipeline.pluginManager.execute('afterGeneration', diagram);

    // 6. Write Output
    const output = {
      version: '2.0.0',
      generatedAt: new Date().toISOString(),
      graph,
      report
    };

    await fs.writeFile(options.outputPath, JSON.stringify(output, null, 2));
    
    // Also write markdown if requested or as default side-effect
    const mdPath = options.outputPath.replace('.json', '.md');
    const extraContent = diagram.extraContent ? `\n\n${diagram.extraContent}` : '';
    
    // Format issues
    let issuesMd = '### Issues\n\n';
    if (report.issues.length === 0) {
      issuesMd += '✅ No architectural issues detected.\n';
    } else {
      issuesMd += '| Severity | Rule | Module | Message |\n';
      issuesMd += '|----------|------|--------|---------|\n';
      for (const issue of report.issues) {
        const severityIcon = issue.severity === 'critical' ? '🔴' : issue.severity === 'high' ? '🟠' : issue.severity === 'medium' ? '🟡' : '⚪';
        issuesMd += `| ${severityIcon} ${issue.severity} | ${issue.ruleId} | \`${issue.nodeId}\` | ${issue.message} |\n`;
      }
    }

    // Format suggestions
    let suggestionsMd = '\n### Suggestions\n\n';
    if (report.suggestions.length === 0) {
      suggestionsMd += 'No suggestions available.\n';
    } else {
      for (const sug of report.suggestions) {
        suggestionsMd += `- ${sug.message}\n`;
      }
    }

    const reportMd = `\n## Analysis Report\n\n**Score: ${report.score}/100**\n\n${issuesMd}${suggestionsMd}`;

    await fs.writeFile(mdPath, `# Architecture Diagram\n\n\`\`\`mermaid\n${diagram.syntax}\n\`\`\`${extraContent}${reportMd}`);

    console.log(`✅ Architecture data written to ${options.outputPath}`);
    console.log(`✅ Diagram written to ${mdPath}`);

    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
