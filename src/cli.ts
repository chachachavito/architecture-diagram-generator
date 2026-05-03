#!/usr/bin/env node
import { Command } from 'commander';
import { ArchitecturePipeline } from './core/ArchitecturePipeline';
import * as path from 'path';

const VERSION = '0.4.16';

async function main() {
  const program = new Command();

  program
    .name('architecture-generator')
    .description('Automated Architecture Diagram Generator (v0.4.16) for Next.js projects')
    .version(VERSION, '-v, --version', 'output the current version')
    .argument('[project-root]', 'Root directory of the project to analyze', '.')
    .option('-o, --output <path>', 'Path to save the generated JSON', 'architecture.json')
    .option('-d, --debug', 'Output detailed debug logs', false)
    .option('-f, --format <format>', 'Output format (json, html, svg)', 'json')
    .action(async (projectRoot, options) => {
      try {
        const absProjectRoot = path.resolve(projectRoot);
        
        const pipeline = new ArchitecturePipeline({
          version: VERSION,
          config: {},
          debug: options.debug,
          rootDir: absProjectRoot,
          outputBase: options.output
        });

        console.log(`Analyzing project at: ${absProjectRoot}`);
        await pipeline.runFull(absProjectRoot);

        console.log(`\nGeneration successful!`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

main();
