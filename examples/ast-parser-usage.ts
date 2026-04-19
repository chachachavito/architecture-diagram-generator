/**
 * Example usage of ASTParser
 * 
 * This demonstrates how to use the ASTParser class to analyze
 * TypeScript/JavaScript files and extract structural information.
 */

import { ASTParser } from '../src/parsers/ASTParser';
import * as path from 'path';

async function main() {
  // Initialize parser with project root directory
  const projectRoot = path.join(__dirname, '..');
  const parser = new ASTParser(projectRoot);

  // Parse a file
  const filePath = 'src/core/FileDiscovery.ts';
  console.log(`\nParsing: ${filePath}\n`);

  const result = await parser.parse(filePath);

  // Display imports
  console.log('=== IMPORTS ===');
  result.imports.forEach((imp) => {
    const type = imp.isExternal ? '[EXTERNAL]' : '[INTERNAL]';
    console.log(`${type} ${imp.source}`);
    if (imp.specifiers.length > 0) {
      console.log(`  Imports: ${imp.specifiers.join(', ')}`);
    }
  });

  // Display exports
  console.log('\n=== EXPORTS ===');
  result.exports.forEach((exp) => {
    const defaultTag = exp.isDefault ? '[DEFAULT]' : '';
    console.log(`${exp.type.toUpperCase()}: ${exp.name} ${defaultTag}`);
  });

  // Display metadata
  console.log('\n=== METADATA ===');
  console.log(`Has Default Export: ${result.metadata.hasDefaultExport}`);
  console.log(`Is React Component: ${result.metadata.isReactComponent}`);
  console.log(`Is API Route: ${result.metadata.isApiRoute}`);

  // Display external calls (will be empty for now, implemented in Phase 3)
  console.log('\n=== EXTERNAL CALLS ===');
  if (result.externalCalls.length === 0) {
    console.log('(None detected - full implementation in Phase 3)');
  } else {
    result.externalCalls.forEach((call) => {
      console.log(`${call.type}: ${call.target} at line ${call.location.line}`);
    });
  }
}

// Run the example
main().catch(console.error);
