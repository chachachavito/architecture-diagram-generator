/**
 * Example usage of DiagramGenerator
 * 
 * This example demonstrates how to:
 * 1. Build a dependency graph from parsed modules
 * 2. Generate Mermaid diagrams with different options
 * 3. Validate the generated syntax
 */

import { DiagramGenerator, DependencyGraph } from '../src/generators';
import { ParsedModule } from '../src/parsers';

// Example 1: Generate a basic diagram from parsed modules
function example1() {
  console.log('=== Example 1: Basic Diagram Generation ===\n');

  const generator = new DiagramGenerator();

  // Sample parsed modules
  const modules: ParsedModule[] = [
    {
      path: 'app/page.tsx',
      imports: [
        { source: 'components/Header.tsx', specifiers: ['Header'], isExternal: false },
        { source: 'lib/api-client.ts', specifiers: ['fetchData'], isExternal: false },
      ],
      exports: [{ name: 'default', type: 'default', isDefault: true }],
      externalCalls: [],
      metadata: {
        hasDefaultExport: true,
        isReactComponent: true,
        isApiRoute: false,
      },
    },
    {
      path: 'components/Header.tsx',
      imports: [],
      exports: [{ name: 'Header', type: 'function', isDefault: false }],
      externalCalls: [],
      metadata: {
        hasDefaultExport: false,
        isReactComponent: true,
        isApiRoute: false,
      },
    },
    {
      path: 'lib/api-client.ts',
      imports: [],
      exports: [{ name: 'fetchData', type: 'function', isDefault: false }],
      externalCalls: [],
      metadata: {
        hasDefaultExport: false,
        isReactComponent: false,
        isApiRoute: false,
      },
    },
    {
      path: 'app/api/users/route.ts',
      imports: [
        { source: 'lib/api-client.ts', specifiers: ['fetchData'], isExternal: false },
      ],
      exports: [{ name: 'GET', type: 'function', isDefault: false }],
      externalCalls: [],
      metadata: {
        hasDefaultExport: false,
        isReactComponent: false,
        isApiRoute: true,
      },
    },
  ];

  // Build graph from modules
  const graph = generator.buildGraph(modules);

  // Generate diagram with default options (TB direction)
  const diagram = generator.generate(graph);

  console.log('Generated Mermaid Diagram:');
  console.log(diagram.syntax);
  console.log('\nMetadata:');
  console.log(`- Nodes: ${diagram.metadata.nodeCount}`);
  console.log(`- Edges: ${diagram.metadata.edgeCount}`);
  console.log(`- Generated at: ${diagram.metadata.generatedAt.toISOString()}`);
  console.log('\n');
}

// Example 2: Generate diagram with custom direction
function example2() {
  console.log('=== Example 2: Left-to-Right Diagram ===\n');

  const generator = new DiagramGenerator();

  const graph: DependencyGraph = {
    nodes: new Map([
      ['app/page.tsx', { id: 'app/page.tsx', type: 'route', label: 'Home Page' }],
      ['app/api/data/route.ts', { id: 'app/api/data/route.ts', type: 'api', label: 'Data API' }],
      ['lib/database.ts', { id: 'lib/database.ts', type: 'utility', label: 'Database' }],
    ]),
    edges: [
      { from: 'app/page.tsx', to: 'app/api/data/route.ts', type: 'import' },
      { from: 'app/api/data/route.ts', to: 'lib/database.ts', type: 'import' },
    ],
  };

  // Generate with left-to-right direction
  const diagram = generator.generate(graph, { direction: 'LR' });

  console.log('Generated Mermaid Diagram (LR):');
  console.log(diagram.syntax);
  console.log('\n');
}

// Example 3: Generate diagram without dependencies
function example3() {
  console.log('=== Example 3: Nodes Only (No Dependencies) ===\n');

  const generator = new DiagramGenerator();

  const graph: DependencyGraph = {
    nodes: new Map([
      ['app/page.tsx', { id: 'app/page.tsx', type: 'route' }],
      ['app/about/page.tsx', { id: 'app/about/page.tsx', type: 'route' }],
      ['app/api/users/route.ts', { id: 'app/api/users/route.ts', type: 'api' }],
      ['app/api/posts/route.ts', { id: 'app/api/posts/route.ts', type: 'api' }],
    ]),
    edges: [
      { from: 'app/page.tsx', to: 'app/api/users/route.ts', type: 'import' },
      { from: 'app/about/page.tsx', to: 'app/api/posts/route.ts', type: 'import' },
    ],
  };

  // Generate without showing dependencies
  const diagram = generator.generate(graph, { showDependencies: false });

  console.log('Generated Mermaid Diagram (Nodes Only):');
  console.log(diagram.syntax);
  console.log('\n');
}

// Example 4: Complex project structure
function example4() {
  console.log('=== Example 4: Complex Project Structure ===\n');

  const generator = new DiagramGenerator();

  const graph: DependencyGraph = {
    nodes: new Map([
      // Routes
      ['app/page.tsx', { id: 'app/page.tsx', type: 'route', label: 'Home' }],
      ['app/dashboard/page.tsx', { id: 'app/dashboard/page.tsx', type: 'route', label: 'Dashboard' }],
      
      // API Routes
      ['app/api/auth/route.ts', { id: 'app/api/auth/route.ts', type: 'api', label: 'Auth API' }],
      ['app/api/data/route.ts', { id: 'app/api/data/route.ts', type: 'api', label: 'Data API' }],
      
      // Components
      ['components/Header.tsx', { id: 'components/Header.tsx', type: 'component', label: 'Header' }],
      ['components/Footer.tsx', { id: 'components/Footer.tsx', type: 'component', label: 'Footer' }],
      
      // Utilities
      ['lib/auth.ts', { id: 'lib/auth.ts', type: 'utility', label: 'Auth Utils' }],
      ['lib/database.ts', { id: 'lib/database.ts', type: 'utility', label: 'Database' }],
    ]),
    edges: [
      // Page dependencies
      { from: 'app/page.tsx', to: 'components/Header.tsx', type: 'import' },
      { from: 'app/page.tsx', to: 'components/Footer.tsx', type: 'import' },
      { from: 'app/dashboard/page.tsx', to: 'components/Header.tsx', type: 'import' },
      { from: 'app/dashboard/page.tsx', to: 'app/api/data/route.ts', type: 'import' },
      
      // API dependencies
      { from: 'app/api/auth/route.ts', to: 'lib/auth.ts', type: 'import' },
      { from: 'app/api/data/route.ts', to: 'lib/database.ts', type: 'import' },
      { from: 'app/api/data/route.ts', to: 'lib/auth.ts', type: 'import' },
    ],
  };

  const diagram = generator.generate(graph, { direction: 'TB' });

  console.log('Generated Mermaid Diagram (Complex):');
  console.log(diagram.syntax);
  console.log('\nMetadata:');
  console.log(`- Nodes: ${diagram.metadata.nodeCount}`);
  console.log(`- Edges: ${diagram.metadata.edgeCount}`);
  console.log('\n');
}

// Run all examples
if (require.main === module) {
  example1();
  example2();
  example3();
  example4();
}
