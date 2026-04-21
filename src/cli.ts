#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FileDiscovery } from './core/FileDiscovery';
import { ASTParser } from './parsers/ASTParser';
import { DependencyGraphBuilder } from './core/DependencyGraphBuilder';
import { ArchitecturePipeline } from './core/ArchitecturePipeline';
import { DiagramGenerator } from './generators/DiagramGenerator';
import { HTMLGenerator } from './generators/HTMLGenerator';

const VERSION = '0.4.15';

async function main() {
  const program = new Command();

  program
    .name('architecture-generator')
    .description('Automated Architecture Diagram Generator (v0.4.15) for Next.js projects')
    .version(VERSION, '-v, --version', 'output the current version')
    .argument('[project-root]', 'Root directory of the project to analyze', '.')
    .option('-o, --output <path>', 'Path to save the generated JSON', 'architecture.json')
    .option('-d, --debug', 'Output detailed debug logs', false)
    .action(async (projectRoot, options) => {
      try {
        const absProjectRoot = path.resolve(projectRoot);
        // Resolve output path relative to project root if it's not absolute
        const outputPath = path.isAbsolute(options.output) 
          ? options.output 
          : path.join(absProjectRoot, options.output);

        console.log(`Analyzing project at: ${absProjectRoot}`);

        // 1. File Discovery
        console.log('Step 1: Discovering files...');
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
        console.log(`Step 2: Parsing ${allFiles.length} files...`);
        const parser = new ASTParser(absProjectRoot);
        const parsedModules = [];
        for (const file of allFiles) {
          try {
            const module = await parser.parse(file);
            parsedModules.push(module);
          } catch (e) {
            if (options.debug) console.error(`   Warning: Failed to parse ${file}`);
          }
        }

        // 3. Build Dependency Graph
        console.log('Step 3: Building dependency graph...');
        const builder = new DependencyGraphBuilder();
        const sourceGraph = builder.build(parsedModules);

        // 4. Run Pipeline
        console.log('Step 4: Normalizing architecture and applying rules...');
        const pipeline = new ArchitecturePipeline({
          version: VERSION,
          config: {},
          debug: options.debug,
          rootDir: absProjectRoot
        });

        const result = await pipeline.run(sourceGraph);
        const graph = result.graph;

        // 5. Generate Diagram
        console.log('Step 5: Generating interactive diagrams...');
        const generator = new DiagramGenerator();
        const diagram = generator.generate(graph);

        // 6. Write Output
        console.log('Step 6: Saving output files...');
        const output = {
          version: VERSION,
          generatedAt: new Date().toISOString(),
          graph
        };

        await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
        
        const mdPath = outputPath.replace('.json', '.md');
        await fs.writeFile(mdPath, `# Architecture Diagram\n\n\`\`\`mermaid\n${diagram.syntax}\n\`\`\``);

        const projectName = path.basename(absProjectRoot);
        const htmlGenerator = new HTMLGenerator();
        const htmlContent = htmlGenerator.generate(graph, projectName);
        const htmlPath = outputPath.replace('.json', '.html');
        await fs.writeFile(htmlPath, htmlContent);

        console.log(`\nGeneration successful!`);
        console.log(`   - Data: ${path.basename(outputPath)}`);
        console.log(`   - Markdown: ${path.basename(mdPath)}`);
        console.log(`   - Dashboard: ${path.basename(htmlPath)} (OPEN THIS IN BROWSER)`);

      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

main();
