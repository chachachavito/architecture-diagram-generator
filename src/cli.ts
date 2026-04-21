import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ASTParser } from './parsers/ASTParser';
import { FileDiscovery } from './core/FileDiscovery';
import { DependencyGraphBuilder } from './core/DependencyGraphBuilder';
import { ArchitecturePipeline } from './core/ArchitecturePipeline';
import { DiagramGenerator } from './generators/DiagramGenerator';
import { HTMLGenerator } from './generators/HTMLGenerator';

async function main() {
  const program = new Command();

  program
    .name('architecture-generator')
    .description('Generate architecture diagrams from TypeScript/Next.js projects')
    .argument('[project-root]', 'Path to project root', '.')
    .option('-o, --output <path>', 'Output JSON path', 'architecture.json')
    .option('-d, --debug', 'Enable debug mode', false)
    .option('--help', 'Display help');

  program.parse(process.argv);

  const options = program.opts();
  const args = program.args;

  try {
    const projectRoot = args[0] || '.';
    const absProjectRoot = path.resolve(projectRoot);
    const outputPath = path.resolve(options.output);

    if (options.help) {
      console.log(`
Architecture Diagram Generator (v0.4.9)

Usage: architecture-generator [project-root] [options]

Options:
  -o, --output <path>  Output JSON path (default: architecture.json)
  -d, --debug          Enable debug mode
  --help               Display help
`);
      process.exit(0);
    }

    if (process.argv.includes('--version') || process.argv.includes('-v')) {
      try {
        const pkg = JSON.parse(await fs.readFile(path.join(__dirname, '../package.json'), 'utf-8'));
        console.log(`v${pkg.version}`);
      } catch (e) {
        console.log('v0.4.9');
      }
      process.exit(0);
    }

    console.log(`Step 1: Analyzing project at: ${absProjectRoot}`);

    // 1. Discovery
    console.log('Step 2: Scanning for files...');
    const discovery = new FileDiscovery();
    const fileList = await discovery.discover(absProjectRoot, { rootDir: absProjectRoot });
    const allFiles = [
      ...fileList.routes,
      ...fileList.api,
      ...fileList.components,
      ...fileList.utilities,
      ...(fileList.config || [])
    ];

    // 2. Parsing
    console.log(`Step 3: Parsing AST and extracting metadata from ${allFiles.length} files...`);
    const parser = new ASTParser(absProjectRoot);
    const parsedModules = [];
    for (const file of allFiles) {
      try {
        const parsed = await parser.parse(file);
        parsedModules.push(parsed);
      } catch (err) {
        if (options.debug) {
          console.error(`Warning: Failed to parse ${file}: ${err}`);
        }
      }
    }

    // 3. Graph Building
    const builder = new DependencyGraphBuilder(absProjectRoot);
    const sourceGraph = builder.build(parsedModules);

    // 4. Run Pipeline
    console.log('Step 4: Normalizing architecture and applying rules...');
    const pipeline = new ArchitecturePipeline({
      version: '0.4.9',
      config: {},
      debug: options.debug,
      rootDir: absProjectRoot
    });

    const { graph } = await pipeline.run(sourceGraph);
    console.log(`Step 5: Graph built with ${graph.nodes.length} nodes and ${graph.edges.length} edges.`);

    // 5. Generate Diagram
    console.log('Step 6: Generating interactive diagrams...');
    const generator = new DiagramGenerator();
    const diagram = generator.generate(graph);

    // 6. Write Output
    console.log('Step 7: Saving output files...');
    const output = {
      version: '0.4.9',
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

    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
