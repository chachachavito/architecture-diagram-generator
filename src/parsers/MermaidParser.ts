/**
 * Mermaid Parser and Pretty Printer
 * 
 * Provides functionality to parse Mermaid diagram syntax into an AST
 * and convert AST back to formatted Mermaid syntax.
 * 
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

/**
 * Represents a node in the Mermaid AST
 */
export interface MermaidNode {
  id: string;
  label: string;
  shape: 'rectangle' | 'rounded' | 'circle' | 'diamond' | 'cylinder' | 'stadium' | 'hexagon';
}

/**
 * Represents an edge in the Mermaid AST
 */
export interface MermaidEdge {
  from: string;
  to: string;
  label?: string;
  style: 'solid' | 'dashed' | 'dotted' | 'thick';
}

/**
 * Represents a subgraph in the Mermaid AST
 */
export interface MermaidSubgraph {
  id: string;
  label: string;
  nodes: string[];
  subgraphs?: MermaidSubgraph[];
}

/**
 * Represents a style definition in the Mermaid AST
 */
export interface MermaidStyle {
  nodeId: string;
  styles: Record<string, string>;
}

/**
 * Represents the Mermaid Abstract Syntax Tree
 */
export interface MermaidAST {
  type: 'graph' | 'flowchart';
  direction: 'TB' | 'LR' | 'BT' | 'RL';
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  subgraphs: MermaidSubgraph[];
  styles: MermaidStyle[];
  init?: Record<string, unknown>;
}

/**
 * Result of parsing Mermaid syntax
 */
export interface ParseResult {
  success: boolean;
  ast?: MermaidAST;
  errors?: ParseError[];
}

/**
 * Represents a parsing error
 */
export interface ParseError {
  line?: number;
  message: string;
  context?: string;
}

/**
 * Result of validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: ParseError[];
}

/**
 * MermaidParser - Parses Mermaid diagram syntax into an AST
 * 
 * Validates: Requirements 8.1, 8.2
 */
export class MermaidParser {
  private currentLine: number = 0;

  /**
   * Parse Mermaid syntax into an AST
   */
  parse(mermaidSyntax: string): ParseResult {
    this.currentLine = 0;
    const errors: ParseError[] = [];
    
    try {
      const lines = mermaidSyntax.split('\n').map(l => l.trim());
      
      // Find the header line (skip init blocks and comments at the start)
      let headerLineIndex = 0;
      let init: Record<string, unknown> | undefined;
      
      while (headerLineIndex < lines.length) {
        const line = lines[headerLineIndex];
        
        // Parse init block
        if (line.startsWith('%%{init:')) {
          init = this.parseInitBlock(line);
          headerLineIndex++;
          continue;
        }
        
        // Skip comments and empty lines
        if (!line || line.startsWith('%%')) {
          headerLineIndex++;
          continue;
        }
        
        break;
      }
      
      // Parse header (graph/flowchart declaration)
      const headerResult = this.parseHeader(lines[headerLineIndex] || '');
      if (!headerResult.success) {
        errors.push(...(headerResult.errors || []));
        return { success: false, errors };
      }

      const ast: MermaidAST = {
        type: headerResult.type!,
        direction: headerResult.direction!,
        nodes: [],
        edges: [],
        subgraphs: [],
        styles: [],
        init,
      };

      // Parse body
      let currentSubgraph: MermaidSubgraph | null = null;
      let subgraphStack: MermaidSubgraph[] = [];

      for (let i = headerLineIndex + 1; i < lines.length; i++) {
        this.currentLine = i + 1;
        const line = lines[i];
        
        // Skip empty lines
        if (!line) {
          continue;
        }

        // Parse init block (must be before comment check since it starts with %%)
        if (line.startsWith('%%{init:')) {
          ast.init = this.parseInitBlock(line);
          continue;
        }

        // Skip comments
        if (line.startsWith('%%')) {
          continue;
        }

        // Parse subgraph
        if (line.startsWith('subgraph')) {
          const subgraph = this.parseSubgraph(line);
          if (subgraph) {
            if (currentSubgraph) {
              // Nested subgraph
              if (!currentSubgraph.subgraphs) {
                currentSubgraph.subgraphs = [];
              }
              currentSubgraph.subgraphs.push(subgraph);
              subgraphStack.push(currentSubgraph);
            }
            currentSubgraph = subgraph;
            ast.subgraphs.push(subgraph);
          }
          continue;
        }

        // End subgraph
        if (line === 'end') {
          if (subgraphStack.length > 0) {
            currentSubgraph = subgraphStack.pop()!;
          } else {
            currentSubgraph = null;
          }
          continue;
        }

        // Parse style definitions
        if (line.startsWith('style ')) {
          const style = this.parseStyle(line);
          if (style) {
            ast.styles.push(style);
          }
          continue;
        }

        // Parse class definitions
        if (line.startsWith('classDef ') || line.startsWith('class ')) {
          continue; // Skip class definitions for now
        }

        // Parse edge
        const edge = this.parseEdge(line);
        if (edge) {
          ast.edges.push(edge);
          // Add nodes if not already present
          this.ensureNodeExists(ast, edge.from, currentSubgraph);
          this.ensureNodeExists(ast, edge.to, null);
          if (currentSubgraph && !currentSubgraph.nodes.includes(edge.from)) {
            currentSubgraph.nodes.push(edge.from);
          }
          continue;
        }

        // Parse node definition
        const node = this.parseNode(line);
        if (node) {
          const existingIndex = ast.nodes.findIndex(n => n.id === node.id);
          if (existingIndex >= 0) {
            // Update existing node with label/shape
            ast.nodes[existingIndex] = node;
          } else {
            ast.nodes.push(node);
          }
          if (currentSubgraph && !currentSubgraph.nodes.includes(node.id)) {
            currentSubgraph.nodes.push(node.id);
          }
        }
      }

      return { success: true, ast };
    } catch (error) {
      return {
        success: false,
        errors: [{
          line: this.currentLine,
          message: error instanceof Error ? error.message : 'Unknown parsing error',
        }],
      };
    }
  }

  /**
   * Validate Mermaid syntax
   */
  validate(mermaidSyntax: string): ValidationResult {
    const result = this.parse(mermaidSyntax);
    return {
      valid: result.success,
      errors: result.errors || [],
    };
  }

  private parseHeader(line: string): { success: boolean; type?: 'graph' | 'flowchart'; direction?: 'TB' | 'LR' | 'BT' | 'RL'; errors?: ParseError[] } {
    const graphMatch = line.match(/^(graph|flowchart)\s+(TB|LR|BT|RL)$/i);
    if (graphMatch) {
      return {
        success: true,
        type: graphMatch[1].toLowerCase() as 'graph' | 'flowchart',
        direction: graphMatch[2].toUpperCase() as 'TB' | 'LR' | 'BT' | 'RL',
      };
    }
    
    // Try without direction (default to TB)
    const simpleMatch = line.match(/^(graph|flowchart)$/i);
    if (simpleMatch) {
      return {
        success: true,
        type: simpleMatch[1].toLowerCase() as 'graph' | 'flowchart',
        direction: 'TB',
      };
    }

    return {
      success: false,
      errors: [{ line: 1, message: 'Invalid Mermaid header. Expected "graph TB|LR|BT|RL" or "flowchart TB|LR|BT|RL"' }],
    };
  }

  private parseInitBlock(line: string): Record<string, unknown> | undefined {
    try {
      // Match %%{init: {...}}%%
      const match = line.match(/%%\{init:\s*(\{.+\})\s*\}%%/);
      if (match) {
        return JSON.parse(match[1]);
      }
      // Also match without trailing %%
      const match2 = line.match(/%%\{init:\s*(\{.+\})\s*\}/);
      if (match2) {
        return JSON.parse(match2[1]);
      }
    } catch {
      // Ignore parse errors for init block
    }
    return undefined;
  }

  private parseSubgraph(line: string): MermaidSubgraph | null {
    // Match: subgraph id["label"] or subgraph id[label] or subgraph id
    const match = line.match(/subgraph\s+(\w+)(?:\s*\[["']?([^"'\]]+)["']?\])?/);
    if (match) {
      return {
        id: match[1],
        label: match[2] || match[1],
        nodes: [],
        subgraphs: [],
      };
    }
    return null;
  }

  private parseStyle(line: string): MermaidStyle | null {
    // Match: style nodeId fill:#color,stroke:#color
    const match = line.match(/style\s+(\w+)\s+(.+)/);
    if (match) {
      const styles: Record<string, string> = {};
      const styleParts = match[2].split(',').map(s => s.trim());
      for (const part of styleParts) {
        const [key, value] = part.split(':').map(s => s.trim());
        if (key && value) {
          styles[key] = value;
        }
      }
      return { nodeId: match[1], styles };
    }
    return null;
  }

  private parseEdge(line: string): MermaidEdge | null {
    // Match various edge patterns:
    // A --> B
    // A -->|label| B
    // A -.-> B
    // A -.->|label| B
    // A ==> B
    // A --- B
    // A["label"] --> B
    // A -->|label| B["label"]
    
    // First, try to extract the edge pattern with labels
    const edgePattern = /^(\w+)(?:\[[^\]]*\])?\s*(-->|-.->|==>|---)\s*\|?([^|]*)\|?\s*(\w+)(?:\[[^\]]*\])?$/;
    const match = line.match(edgePattern);
    
    if (match) {
      let style: MermaidEdge['style'] = 'solid';
      const arrowType = match[2];
      
      if (arrowType === '-.->') {
        style = 'dashed';
      } else if (arrowType === '==>') {
        style = 'thick';
      } else if (arrowType === '---') {
        style = 'solid';
      }

      const label = match[3]?.trim();
      
      return {
        from: match[1],
        to: match[4],
        label: label && label.length > 0 ? label : undefined,
        style,
      };
    }

    // Try simpler pattern without label
    const simplePattern = /^(\w+)(?:\[[^\]]*\])?\s*(-->|-.->|==>|---)\s*(\w+)(?:\[[^\]]*\])?$/;
    const simpleMatch = line.match(simplePattern);
    
    if (simpleMatch) {
      let style: MermaidEdge['style'] = 'solid';
      const arrowType = simpleMatch[2];
      
      if (arrowType === '-.->') {
        style = 'dashed';
      } else if (arrowType === '==>') {
        style = 'thick';
      }

      return {
        from: simpleMatch[1],
        to: simpleMatch[3],
        style,
      };
    }

    return null;
  }

  private parseNode(line: string): MermaidNode | null {
    // Match various node shapes:
    // id[label] - rectangle
    // id(label) - rounded
    // id((label)) - circle
    // id{label} - diamond
    // id[(label)] - cylinder
    // id([label]) - stadium
    
    const patterns: Array<{ pattern: RegExp; shape: MermaidNode['shape'] }> = [
      { pattern: /^(\w+)\(\((.+)\)\)$/, shape: 'circle' },
      { pattern: /^(\w+)\[(.+)\]$/, shape: 'rectangle' },
      { pattern: /^(\w+)\((.+)\)$/, shape: 'rounded' },
      { pattern: /^(\w+)\{(.+)\}$/, shape: 'diamond' },
      { pattern: /^(\w+)\[\((.+)\)\]$/, shape: 'stadium' },
      { pattern: /^(\w+)\(\[(.+)\]\)$/, shape: 'cylinder' },
      { pattern: /^(\w+)\{\{(.+)\}\}$/, shape: 'hexagon' },
    ];

    for (const { pattern, shape } of patterns) {
      const match = line.match(pattern);
      if (match) {
        return {
          id: match[1],
          label: match[2],
          shape,
        };
      }
    }

    // Simple node without shape
    const simpleMatch = line.match(/^(\w+)$/);
    if (simpleMatch) {
      return {
        id: simpleMatch[1],
        label: simpleMatch[1],
        shape: 'rectangle',
      };
    }

    return null;
  }

  private ensureNodeExists(ast: MermaidAST, nodeId: string, currentSubgraph: MermaidSubgraph | null): void {
    if (!ast.nodes.find(n => n.id === nodeId)) {
      ast.nodes.push({
        id: nodeId,
        label: nodeId,
        shape: 'rectangle',
      });
    }
    if (currentSubgraph && !currentSubgraph.nodes.includes(nodeId)) {
      currentSubgraph.nodes.push(nodeId);
    }
  }
}

/**
 * MermaidPrettyPrinter - Converts AST to formatted Mermaid syntax
 * 
 * Validates: Requirements 8.3, 8.4
 */
export class MermaidPrettyPrinter {
  private indentSize: number = 4;

  /**
   * Convert AST to formatted Mermaid syntax
   */
  print(ast: MermaidAST): string {
    const lines: string[] = [];

    // Add init block if present
    if (ast.init) {
      lines.push(`%%{init: ${JSON.stringify(ast.init)}}%%`);
    }

    // Add header
    lines.push(`${ast.type} ${ast.direction}`);

    // Add subgraphs and their contents
    for (const subgraph of ast.subgraphs) {
      this.printSubgraph(lines, subgraph, 0);
    }

    // Add standalone nodes (not in subgraphs)
    const nodesInSubgraphs = new Set(ast.subgraphs.flatMap(s => s.nodes));
    const standaloneNodes = ast.nodes.filter(n => !nodesInSubgraphs.has(n.id));
    
    for (const node of standaloneNodes) {
      lines.push(this.formatNode(node));
    }

    // Add edges
    for (const edge of ast.edges) {
      lines.push(this.formatEdge(edge));
    }

    // Add styles
    for (const style of ast.styles) {
      lines.push(this.formatStyle(style));
    }

    return lines.join('\n');
  }

  /**
   * Format existing Mermaid syntax
   */
  format(mermaidSyntax: string): string {
    const parser = new MermaidParser();
    const result = parser.parse(mermaidSyntax);
    
    if (!result.success || !result.ast) {
      throw new Error(`Cannot format invalid Mermaid syntax: ${result.errors?.map(e => e.message).join(', ')}`);
    }

    return this.print(result.ast);
  }

  private printSubgraph(lines: string[], subgraph: MermaidSubgraph, depth: number): void {
    const indent = ' '.repeat(depth * this.indentSize);
    
    lines.push(`${indent}subgraph ${subgraph.id}["${subgraph.label}"]`);
    
    // Add nested subgraphs
    if (subgraph.subgraphs) {
      for (const nested of subgraph.subgraphs) {
        this.printSubgraph(lines, nested, depth + 1);
      }
    }
    
    // Add nodes in this subgraph
    for (const nodeId of subgraph.nodes) {
      lines.push(`${indent}${this.formatNodeId(nodeId)}`);
    }
    
    lines.push(`${indent}end`);
  }

  private formatNode(node: MermaidNode): string {
    const label = this.escapeLabel(node.label);
    
    switch (node.shape) {
      case 'circle':
        return `${node.id}((${label}))`;
      case 'rounded':
        return `${node.id}(${label})`;
      case 'diamond':
        return `${node.id}{${label}}`;
      case 'cylinder':
        return `${node.id}([${label}])`;
      case 'stadium':
        return `${node.id}([${label}])`;
      case 'hexagon':
        return `${node.id}{{${label}}}`;
      case 'rectangle':
      default:
        return `${node.id}[${label}]`;
    }
  }

  private formatNodeId(nodeId: string): string {
    return nodeId;
  }

  private formatEdge(edge: MermaidEdge): string {
    let arrow: string;
    
    switch (edge.style) {
      case 'dashed':
        arrow = '-.->';
        break;
      case 'thick':
        arrow = '==>';
        break;
      case 'dotted':
        arrow = '-.->';
        break;
      case 'solid':
      default:
        arrow = '-->';
        break;
    }

    if (edge.label) {
      return `${edge.from} ${arrow}|${this.escapeLabel(edge.label)}| ${edge.to}`;
    }
    
    return `${edge.from} ${arrow} ${edge.to}`;
  }

  private formatStyle(style: MermaidStyle): string {
    const styleStr = Object.entries(style.styles)
      .map(([key, value]) => `${key}:${value}`)
      .join(', ');
    return `style ${style.nodeId} ${styleStr}`;
  }

  private escapeLabel(label: string): string {
    // Escape special characters in label
    return label
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');
  }
}

/**
 * Round-trip test helper
 * Validates: Requirement 8.5
 */
export function roundTripTest(mermaidSyntax: string): { success: boolean; original: string; result: string; error?: string } {
  const parser = new MermaidParser();
  const printer = new MermaidPrettyPrinter();
  
  const parseResult = parser.parse(mermaidSyntax);
  if (!parseResult.success) {
    return {
      success: false,
      original: mermaidSyntax,
      result: '',
      error: parseResult.errors?.map(e => e.message).join(', '),
    };
  }

  const printed = printer.print(parseResult.ast!);
  const reparsed = parser.parse(printed);
  
  if (!reparsed.success) {
    return {
      success: false,
      original: mermaidSyntax,
      result: printed,
      error: reparsed.errors?.map(e => e.message).join(', '),
    };
  }

  // Compare ASTs (semantic equivalence, not string equality)
  const astsEqual = compareASTs(parseResult.ast!, reparsed.ast!);
  
  return {
    success: astsEqual,
    original: mermaidSyntax,
    result: printed,
  };
}

/**
 * Compare two ASTs for semantic equivalence
 */
function compareASTs(a: MermaidAST, b: MermaidAST): boolean {
  if (a.type !== b.type || a.direction !== b.direction) return false;
  
  // Compare nodes
  const nodesA = new Map(a.nodes.map(n => [n.id, n]));
  const nodesB = new Map(b.nodes.map(n => [n.id, n]));
  
  if (nodesA.size !== nodesB.size) return false;
  
  for (const [id, nodeA] of nodesA) {
    const nodeB = nodesB.get(id);
    if (!nodeB || nodeA.label !== nodeB.label || nodeA.shape !== nodeB.shape) {
      return false;
    }
  }
  
  // Compare edges
  if (a.edges.length !== b.edges.length) return false;
  
  const edgeKey = (e: MermaidEdge) => `${e.from}->${e.to}`;
  const edgesA = new Set(a.edges.map(edgeKey));
  const edgesB = new Set(b.edges.map(edgeKey));
  
  if (edgesA.size !== edgesB.size) return false;
  
  for (const key of edgesA) {
    if (!edgesB.has(key)) return false;
  }
  
  return true;
}
