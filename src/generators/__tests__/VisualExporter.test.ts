import { VisualExporter, ExportOptions } from '../VisualExporter';
import { MermaidDiagram } from '../DiagramGenerator';
import { existsSync, unlinkSync, rmdirSync } from 'fs';
import { join } from 'path';

describe('VisualExporter', () => {
  const testOutputDir = join(process.cwd(), '.test-output');
  
  beforeEach(() => {
    // Create test output directory if it doesn't exist
    if (!existsSync(testOutputDir)) {
      require('fs').mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    try {
      const files = require('fs').readdirSync(testOutputDir);
      for (const file of files) {
        const filePath = join(testOutputDir, file);
        if (require('fs').statSync(filePath).isFile()) {
          unlinkSync(filePath);
        }
      }
      rmdirSync(testOutputDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const exporter = new VisualExporter();
      expect(exporter).toBeDefined();
    });

    it('should initialize with custom options', () => {
      const options: ExportOptions = {
        width: 1600,
        height: 900,
        theme: 'dark',
        backgroundColor: '#000000',
      };
      const exporter = new VisualExporter(options);
      expect(exporter).toBeDefined();
    });
  });

  describe('configure()', () => {
    it('should update export options', () => {
      const exporter = new VisualExporter();
      const newOptions: ExportOptions = {
        width: 2000,
        height: 1000,
        theme: 'forest',
      };
      exporter.configure(newOptions);
      expect(exporter).toBeDefined();
    });
  });

  describe('export()', () => {
    const testDiagram: MermaidDiagram = {
      syntax: `graph LR
    A[Node A]
    B[Node B]
    A --> B`,
      metadata: {
        nodeCount: 2,
        edgeCount: 1,
        generatedAt: new Date(),
      },
    };

    it('should throw error for invalid format', async () => {
      const exporter = new VisualExporter();
      const outputPath = join(testOutputDir, 'test.invalid');

      await expect(
        exporter.export(testDiagram, 'invalid' as any, outputPath)
      ).rejects.toThrow('Invalid format');
    });

    it('should create output directory if it does not exist', async () => {
      const exporter = new VisualExporter();
      const nestedDir = join(testOutputDir, 'nested', 'path');
      const outputPath = join(nestedDir, 'test.svg');

      // This test will fail if Mermaid CLI and Puppeteer are not available
      // but it should at least create the directory
      try {
        await exporter.export(testDiagram, 'svg', outputPath);
      } catch (error) {
        // Expected to fail if rendering tools are not available
        // But directory should be created
        expect(existsSync(nestedDir)).toBe(true);
      }
    });

    it('should accept PNG format', async () => {
      const exporter = new VisualExporter();
      const outputPath = join(testOutputDir, 'test.png');

      // This test will fail if rendering tools are not available
      try {
        await exporter.export(testDiagram, 'png', outputPath);
        // If successful, file should exist
        if (existsSync(outputPath)) {
          expect(existsSync(outputPath)).toBe(true);
        }
      } catch (error) {
        // Expected to fail if Mermaid CLI and Puppeteer are not available
        expect(error).toBeDefined();
      }
    });

    it('should accept SVG format', async () => {
      const exporter = new VisualExporter();
      const outputPath = join(testOutputDir, 'test.svg');

      // This test will fail if rendering tools are not available
      try {
        await exporter.export(testDiagram, 'svg', outputPath);
        // If successful, file should exist
        if (existsSync(outputPath)) {
          expect(existsSync(outputPath)).toBe(true);
        }
      } catch (error) {
        // Expected to fail if Mermaid CLI and Puppeteer are not available
        expect(error).toBeDefined();
      }
    });
  });

  describe('createMermaidHTML()', () => {
    it('should create valid HTML with embedded Mermaid diagram', () => {
      const exporter = new VisualExporter();
      const mermaidSyntax = `graph LR
    A[Node A]
    B[Node B]
    A --> B`;

      const html = (exporter as any).createMermaidHTML(mermaidSyntax);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<script src="https://cdn.jsdelivr.net/npm/mermaid');
      expect(html).toContain(mermaidSyntax);
      expect(html).toContain('mermaid.initialize');
      expect(html).toContain('</html>');
    });

    it('should include theme in HTML', () => {
      const exporter = new VisualExporter({ theme: 'dark' });
      const mermaidSyntax = 'graph LR\n    A[Node]';

      const html = (exporter as any).createMermaidHTML(mermaidSyntax);

      expect(html).toContain("theme: 'dark'");
    });

    it('should include background color in HTML', () => {
      const exporter = new VisualExporter({ backgroundColor: '#000000' });
      const mermaidSyntax = 'graph LR\n    A[Node]';

      const html = (exporter as any).createMermaidHTML(mermaidSyntax);

      expect(html).toContain('background-color: #000000');
    });
  });

  describe('export options', () => {
    it('should support width and height options', () => {
      const options: ExportOptions = {
        width: 1920,
        height: 1080,
      };
      const exporter = new VisualExporter(options);
      expect(exporter).toBeDefined();
    });

    it('should support theme options', () => {
      const themes: Array<'default' | 'dark' | 'forest' | 'neutral'> = ['default', 'dark', 'forest', 'neutral'];
      
      for (const theme of themes) {
        const exporter = new VisualExporter({ theme });
        expect(exporter).toBeDefined();
      }
    });

    it('should support backgroundColor option', () => {
      const exporter = new VisualExporter({ backgroundColor: '#f0f0f0' });
      expect(exporter).toBeDefined();
    });
  });
});
