/**
 * Unit tests for MermaidParser and MermaidPrettyPrinter
 * 
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 */

import { describe, it, expect } from 'vitest';
import { MermaidParser, MermaidPrettyPrinter, roundTripTest } from './MermaidParser';

describe('MermaidParser', () => {
  describe('parse', () => {
    it('should parse a simple graph header', () => {
      const parser = new MermaidParser();
      const result = parser.parse('graph TB');
      
      expect(result.success).toBe(true);
      expect(result.ast?.type).toBe('graph');
      expect(result.ast?.direction).toBe('TB');
    });

    it('should parse a flowchart header', () => {
      const parser = new MermaidParser();
      const result = parser.parse('flowchart LR');
      
      expect(result.success).toBe(true);
      expect(result.ast?.type).toBe('flowchart');
      expect(result.ast?.direction).toBe('LR');
    });

    it('should parse all direction options', () => {
      const parser = new MermaidParser();
      const directions = ['TB', 'LR', 'BT', 'RL'] as const;
      
      for (const dir of directions) {
        const result = parser.parse(`graph ${dir}`);
        expect(result.success).toBe(true);
        expect(result.ast?.direction).toBe(dir);
      }
    });

    it('should parse simple nodes', () => {
      const parser = new MermaidParser();
      const result = parser.parse(`graph TB
    A
    B`);
      
      expect(result.success).toBe(true);
      expect(result.ast?.nodes).toHaveLength(2);
      expect(result.ast?.nodes[0].id).toBe('A');
      expect(result.ast?.nodes[1].id).toBe('B');
    });

    it('should parse nodes with rectangle shape', () => {
      const parser = new MermaidParser();
      const result = parser.parse(`graph TB
    A[Label A]`);
      
      expect(result.success).toBe(true);
      expect(result.ast?.nodes).toHaveLength(1);
      expect(result.ast?.nodes[0].id).toBe('A');
      expect(result.ast?.nodes[0].label).toBe('Label A');
      expect(result.ast?.nodes[0].shape).toBe('rectangle');
    });

    it('should parse nodes with rounded shape', () => {
      const parser = new MermaidParser();
      const result = parser.parse(`graph TB
    A(Label A)`);
      
      expect(result.success).toBe(true);
      expect(result.ast?.nodes[0].shape).toBe('rounded');
    });

    it('should parse nodes with circle shape', () => {
      const parser = new MermaidParser();
      const result = parser.parse(`graph TB
    A((Label A))`);
      
      expect(result.success).toBe(true);
      expect(result.ast?.nodes[0].shape).toBe('circle');
    });

    it('should parse nodes with diamond shape', () => {
      const parser = new MermaidParser();
      const result = parser.parse(`graph TB
    A{Label A}`);
      
      expect(result.success).toBe(true);
      expect(result.ast?.nodes[0].shape).toBe('diamond');
    });

    it('should parse simple edges', () => {
      const parser = new MermaidParser();
      const result = parser.parse(`graph TB
    A --> B`);
      
      expect(result.success).toBe(true);
      expect(result.ast?.edges).toHaveLength(1);
      expect(result.ast?.edges[0].from).toBe('A');
      expect(result.ast?.edges[0].to).toBe('B');
      expect(result.ast?.edges[0].style).toBe('solid');
    });

    it('should parse edges with labels', () => {
      const parser = new MermaidParser();
      const result = parser.parse(`graph TB
    A -->|uses| B`);
      
      expect(result.success).toBe(true);
      expect(result.ast?.edges[0].label).toBe('uses');
    });

    it('should parse dashed edges', () => {
      const parser = new MermaidParser();
      const result = parser.parse(`graph TB
    A -.-> B`);
      
      expect(result.success).toBe(true);
      expect(result.ast?.edges[0].style).toBe('dashed');
    });

    it('should parse thick edges', () => {
      const parser = new MermaidParser();
      const result = parser.parse(`graph TB
    A ==> B`);
      
      expect(result.success).toBe(true);
      expect(result.ast?.edges[0].style).toBe('thick');
    });

    it('should parse subgraphs', () => {
      const parser = new MermaidParser();
      const result = parser.parse(`graph TB
    subgraph UI["UI Layer"]
        A
        B
    end`);
      
      expect(result.success).toBe(true);
      expect(result.ast?.subgraphs).toHaveLength(1);
      expect(result.ast?.subgraphs[0].id).toBe('UI');
      expect(result.ast?.subgraphs[0].label).toBe('UI Layer');
      expect(result.ast?.subgraphs[0].nodes).toContain('A');
      expect(result.ast?.subgraphs[0].nodes).toContain('B');
    });

    it('should parse style definitions', () => {
      const parser = new MermaidParser();
      const result = parser.parse(`graph TB
    A
    style A fill:#3B82F6,stroke:#1D4ED8`);
      
      expect(result.success).toBe(true);
      expect(result.ast?.styles).toHaveLength(1);
      expect(result.ast?.styles[0].nodeId).toBe('A');
      expect(result.ast?.styles[0].styles.fill).toBe('#3B82F6');
    });

    it('should parse init block', () => {
      const parser = new MermaidParser();
      const result = parser.parse(`%%{init: {"theme": "dark"}}%%
graph TB
    A --> B`);
      
      expect(result.success).toBe(true);
      expect(result.ast?.init).toEqual({ theme: 'dark' });
    });

    it('should skip comments', () => {
      const parser = new MermaidParser();
      const result = parser.parse(`graph TB
    %% This is a comment
    A --> B`);
      
      expect(result.success).toBe(true);
      expect(result.ast?.edges).toHaveLength(1);
    });

    it('should return error for invalid header', () => {
      const parser = new MermaidParser();
      const result = parser.parse('invalid syntax');
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].message).toContain('Invalid Mermaid header');
    });
  });

  describe('validate', () => {
    it('should return valid for correct syntax', () => {
      const parser = new MermaidParser();
      const result = parser.validate(`graph TB
    A --> B`);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid for incorrect syntax', () => {
      const parser = new MermaidParser();
      const result = parser.validate('not a mermaid diagram');
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('MermaidPrettyPrinter', () => {
  describe('print', () => {
    it('should print a simple graph', () => {
      const printer = new MermaidPrettyPrinter();
      const ast = {
        type: 'graph' as const,
        direction: 'TB' as const,
        nodes: [
          { id: 'A', label: 'A', shape: 'rectangle' as const },
          { id: 'B', label: 'B', shape: 'rectangle' as const },
        ],
        edges: [{ from: 'A', to: 'B', style: 'solid' as const }],
        subgraphs: [],
        styles: [],
      };
      
      const result = printer.print(ast);
      
      expect(result).toContain('graph TB');
      expect(result).toContain('A --> B');
    });

    it('should print nodes with different shapes', () => {
      const printer = new MermaidPrettyPrinter();
      const ast = {
        type: 'graph' as const,
        direction: 'TB' as const,
        nodes: [
          { id: 'A', label: 'Rectangle', shape: 'rectangle' as const },
          { id: 'B', label: 'Rounded', shape: 'rounded' as const },
          { id: 'C', label: 'Circle', shape: 'circle' as const },
          { id: 'D', label: 'Diamond', shape: 'diamond' as const },
        ],
        edges: [],
        subgraphs: [],
        styles: [],
      };
      
      const result = printer.print(ast);
      
      expect(result).toContain('A[Rectangle]');
      expect(result).toContain('B(Rounded)');
      expect(result).toContain('C((Circle))');
      expect(result).toContain('D{Diamond}');
    });

    it('should print edges with labels', () => {
      const printer = new MermaidPrettyPrinter();
      const ast = {
        type: 'graph' as const,
        direction: 'LR' as const,
        nodes: [
          { id: 'A', label: 'A', shape: 'rectangle' as const },
          { id: 'B', label: 'B', shape: 'rectangle' as const },
        ],
        edges: [{ from: 'A', to: 'B', label: 'uses', style: 'solid' as const }],
        subgraphs: [],
        styles: [],
      };
      
      const result = printer.print(ast);
      
      expect(result).toContain('A -->|uses| B');
    });

    it('should print dashed edges', () => {
      const printer = new MermaidPrettyPrinter();
      const ast = {
        type: 'graph' as const,
        direction: 'TB' as const,
        nodes: [
          { id: 'A', label: 'A', shape: 'rectangle' as const },
          { id: 'B', label: 'B', shape: 'rectangle' as const },
        ],
        edges: [{ from: 'A', to: 'B', style: 'dashed' as const }],
        subgraphs: [],
        styles: [],
      };
      
      const result = printer.print(ast);
      
      expect(result).toContain('A -.-> B');
    });

    it('should print subgraphs', () => {
      const printer = new MermaidPrettyPrinter();
      const ast = {
        type: 'graph' as const,
        direction: 'TB' as const,
        nodes: [
          { id: 'A', label: 'Node A', shape: 'rectangle' as const },
          { id: 'B', label: 'Node B', shape: 'rectangle' as const },
        ],
        edges: [],
        subgraphs: [{
          id: 'UI',
          label: 'UI Layer',
          nodes: ['A', 'B'],
        }],
        styles: [],
      };
      
      const result = printer.print(ast);
      
      expect(result).toContain('subgraph UI["UI Layer"]');
      expect(result).toContain('end');
    });

    it('should print styles', () => {
      const printer = new MermaidPrettyPrinter();
      const ast = {
        type: 'graph' as const,
        direction: 'TB' as const,
        nodes: [{ id: 'A', label: 'A', shape: 'rectangle' as const }],
        edges: [],
        subgraphs: [],
        styles: [{
          nodeId: 'A',
          styles: { fill: '#3B82F6', stroke: '#1D4ED8' },
        }],
      };
      
      const result = printer.print(ast);
      
      expect(result).toContain('style A fill:#3B82F6, stroke:#1D4ED8');
    });

    it('should print init block', () => {
      const printer = new MermaidPrettyPrinter();
      const ast = {
        type: 'graph' as const,
        direction: 'TB' as const,
        nodes: [],
        edges: [],
        subgraphs: [],
        styles: [],
        init: { theme: 'dark' },
      };
      
      const result = printer.print(ast);
      
      expect(result).toContain('%%{init: {"theme":"dark"}}%%');
    });
  });

  describe('format', () => {
    it('should format existing Mermaid syntax', () => {
      const printer = new MermaidPrettyPrinter();
      const result = printer.format(`graph TB
A-->B`);
      
      expect(result).toContain('graph TB');
      expect(result).toContain('A --> B');
    });

    it('should throw error for invalid syntax', () => {
      const printer = new MermaidPrettyPrinter();
      
      expect(() => printer.format('invalid')).toThrow('Cannot format invalid Mermaid syntax');
    });
  });
});

describe('roundTripTest', () => {
  it('should pass round-trip test for simple graph', () => {
    const mermaid = `graph TB
A --> B`;
    
    const result = roundTripTest(mermaid);
    
    expect(result.success).toBe(true);
  });

  it('should pass round-trip test for graph with subgraphs', () => {
    const mermaid = `graph TB
subgraph UI["UI Layer"]
A
B
end
A --> B`;
    
    const result = roundTripTest(mermaid);
    
    expect(result.success).toBe(true);
  });

  it('should pass round-trip test for complex graph', () => {
    const mermaid = `graph LR
subgraph API["API Layer"]
RiskAPI
WeatherAPI
end
subgraph UI["UI Layer"]
RiskPage
end
RiskPage --> RiskAPI
WeatherAPI --> ExternalAPI`;
    
    const result = roundTripTest(mermaid);
    
    expect(result.success).toBe(true);
  });

  it('should fail for invalid syntax', () => {
    const result = roundTripTest('not valid mermaid');
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
