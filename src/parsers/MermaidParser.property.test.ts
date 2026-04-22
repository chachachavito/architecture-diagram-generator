/**
 * Property-based tests for MermaidParser and MermaidPrettyPrinter
 * 
 * Validates: Requirements 8.5, 8.6
 * Property 1: Round-trip preservation
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { MermaidParser, MermaidPrettyPrinter, MermaidAST } from './MermaidParser';

/**
 * Property 1: Round-trip preservation
 * Validates: Requirements 8.5, 8.6
 * 
 * For any valid Mermaid AST, printing and parsing should produce
 * a semantically equivalent AST.
 */
describe('MermaidParser - Round-trip Property', () => {
  const parser = new MermaidParser();
  const printer = new MermaidPrettyPrinter();

  // Arbitrary for valid node IDs (must start with letter, alphanumeric only, no spaces)
  const nodeIdArbitrary = fc.tuple(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'),
    fc.string({
      unit: fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'),
      minLength: 0,
      maxLength: 19
    })
  ).map(([first, rest]) => first + rest);

  // Arbitrary for valid labels (no special characters that break Mermaid)
  // Must have at least one character, alphanumeric only
  const labelArbitrary = fc.tuple(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'),
    fc.string({
      unit: fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'),
      minLength: 0,
      maxLength: 19
    })
  ).map(([first, rest]) => first + rest);

  // Arbitrary for node shapes
  const shapeArbitrary = fc.constantFrom<'rectangle' | 'rounded' | 'circle' | 'diamond'>(
    'rectangle', 'rounded', 'circle', 'diamond'
  );

  // Arbitrary for edge styles
  const edgeStyleArbitrary = fc.constantFrom<'solid' | 'dashed' | 'thick'>(
    'solid', 'dashed', 'thick'
  );

  // Arbitrary for graph directions
  const directionArbitrary = fc.constantFrom<'TB' | 'LR' | 'BT' | 'RL'>(
    'TB', 'LR', 'BT', 'RL'
  );

  // Arbitrary for graph types
  const graphTypeArbitrary = fc.constantFrom<'graph' | 'flowchart'>(
    'graph', 'flowchart'
  );

  // Arbitrary for a single node
  const nodeArbitrary = fc.record({
    id: nodeIdArbitrary,
    label: labelArbitrary,
    shape: shapeArbitrary,
  });

  // Arbitrary for a single edge
  const edgeArbitrary = fc.record({
    from: nodeIdArbitrary,
    to: nodeIdArbitrary,
    label: fc.option(labelArbitrary, { nil: undefined }),
    style: edgeStyleArbitrary,
  });

  // Arbitrary for a complete Mermaid AST
  const mermaidASTArbitrary = fc.record({
    type: graphTypeArbitrary,
    direction: directionArbitrary,
    nodes: fc.array(nodeArbitrary, { minLength: 0, maxLength: 10 }),
    edges: fc.array(edgeArbitrary, { minLength: 0, maxLength: 10 }),
    subgraphs: fc.constant([]), // Simplified for property test
    styles: fc.constant([]), // Simplified for property test
  });

  it('Property 1: Round-trip preservation - parse(print(ast)) should be semantically equivalent to original AST', () => {
    fc.assert(
      fc.property(mermaidASTArbitrary, (ast: MermaidAST) => {
        // Skip invalid ASTs (edges without corresponding nodes)
        const nodeIds = new Set(ast.nodes.map(n => n.id));
        const hasValidEdges = ast.edges.every(e => 
          nodeIds.has(e.from) && nodeIds.has(e.to)
        );
        if (!hasValidEdges && ast.edges.length > 0) {
          return true; // Skip this case
        }
        
        // Print the AST to Mermaid syntax
        const printed = printer.print(ast);
        
        // Parse it back
        const parseResult = parser.parse(printed);
        
        // Should parse successfully
        expect(parseResult.success).toBe(true);
        if (!parseResult.success) return false;
        
        // Compare ASTs
        const reparsed = parseResult.ast!;
        
        // Type and direction should match
        if (reparsed.type !== ast.type) return false;
        if (reparsed.direction !== ast.direction) return false;
        
        // Node count should match
        if (reparsed.nodes.length !== ast.nodes.length) return false;
        
        // All nodes should be present
        const originalNodeIds = new Set(ast.nodes.map(n => n.id));
        const reparsedNodeIds = new Set(reparsed.nodes.map(n => n.id));
        
        if (originalNodeIds.size !== reparsedNodeIds.size) return false;
        for (const id of originalNodeIds) {
          if (!reparsedNodeIds.has(id)) return false;
        }
        
        // Edge count should match
        if (reparsed.edges.length !== ast.edges.length) return false;
        
        // All edges should be present
        const originalEdges = new Set(ast.edges.map(e => `${e.from}->${e.to}`));
        const reparsedEdges = new Set(reparsed.edges.map(e => `${e.from}->${e.to}`));
        
        if (originalEdges.size !== reparsedEdges.size) return false;
        for (const edge of originalEdges) {
          if (!reparsedEdges.has(edge)) return false;
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 2: Valid syntax should always parse successfully', () => {
    fc.assert(
      fc.property(mermaidASTArbitrary, (ast: MermaidAST) => {
        const printed = printer.print(ast);
        const result = parser.validate(printed);
        
        expect(result.valid).toBe(true);
        return result.valid;
      }),
      { numRuns: 50 }
    );
  });

  it('Property 3: Formatting should be idempotent', () => {
    fc.assert(
      fc.property(mermaidASTArbitrary, (ast: MermaidAST) => {
        // First print
        const firstPrint = printer.print(ast);
        
        // Parse and print again
        const parseResult = parser.parse(firstPrint);
        if (!parseResult.success) return false;
        
        const secondPrint = printer.print(parseResult.ast!);
        
        // Third iteration
        const thirdParseResult = parser.parse(secondPrint);
        if (!thirdParseResult.success) return false;
        
        const thirdPrint = printer.print(thirdParseResult.ast!);
        
        // Second and third prints should be identical
        expect(secondPrint).toBe(thirdPrint);
        return secondPrint === thirdPrint;
      }),
      { numRuns: 50 }
    );
  });

  it('Property 4: Node IDs should be preserved across round-trip', () => {
    fc.assert(
      fc.property(
        graphTypeArbitrary,
        directionArbitrary,
        fc.uniqueArray(nodeIdArbitrary, { minLength: 1, maxLength: 10 }),
        (type, direction, nodeIds) => {
          const ast: MermaidAST = {
            type,
            direction,
            nodes: nodeIds.map(id => ({ id, label: id, shape: 'rectangle' as const })),
            edges: [],
            subgraphs: [],
            styles: [],
          };
          
          const printed = printer.print(ast);
          const parseResult = parser.parse(printed);
          
          expect(parseResult.success).toBe(true);
          if (!parseResult.success) return false;
          
          const reparsedNodeIds = new Set(parseResult.ast!.nodes.map(n => n.id));
          
          for (const id of nodeIds) {
            expect(reparsedNodeIds.has(id)).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 5: Edge connections should be preserved across round-trip', () => {
    fc.assert(
      fc.property(
        graphTypeArbitrary,
        directionArbitrary,
        fc.uniqueArray(nodeIdArbitrary, { minLength: 2, maxLength: 5 }),
        fc.array(
          fc.record({
            from: nodeIdArbitrary,
            to: nodeIdArbitrary,
            style: edgeStyleArbitrary,
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (type, direction, nodeIds, edges) => {
          // Ensure edge endpoints are valid node IDs
          const validEdges = edges.filter(
            e => nodeIds.includes(e.from) && nodeIds.includes(e.to) && e.from !== e.to
          );
          
          if (validEdges.length === 0) return true;
          
          const ast: MermaidAST = {
            type,
            direction,
            nodes: nodeIds.map(id => ({ id, label: id, shape: 'rectangle' as const })),
            edges: validEdges,
            subgraphs: [],
            styles: [],
          };
          
          const printed = printer.print(ast);
          const parseResult = parser.parse(printed);
          
          expect(parseResult.success).toBe(true);
          if (!parseResult.success) return false;
          
          const originalConnections = new Set(
            validEdges.map(e => `${e.from}->${e.to}`)
          );
          const reparsedConnections = new Set(
            parseResult.ast!.edges.map(e => `${e.from}->${e.to}`)
          );
          
          expect(reparsedConnections.size).toBe(originalConnections.size);
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
