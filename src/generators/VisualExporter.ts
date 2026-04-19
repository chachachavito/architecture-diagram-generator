import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { MermaidDiagram } from './DiagramGenerator';

/**
 * Configuration options for visual export
 */
export interface ExportOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  theme?: 'default' | 'dark' | 'forest' | 'neutral';
}

/**
 * VisualExporter class handles exporting Mermaid diagrams to image formats (PNG, SVG)
 * Supports both Mermaid CLI and Puppeteer as fallback rendering engines
 */
export class VisualExporter {
  private options: ExportOptions;

  constructor(options: ExportOptions = {}) {
    this.options = {
      width: options.width || 1200,
      height: options.height || 800,
      backgroundColor: options.backgroundColor || '#ffffff',
      theme: options.theme || 'default',
    };
  }

  /**
   * Exports a Mermaid diagram to PNG or SVG format
   * @param diagram - Mermaid diagram to export
   * @param format - Output format ('png' or 'svg')
   * @param outputPath - Path where to save the file
   * @throws Error if export fails
   */
  async export(diagram: MermaidDiagram, format: 'png' | 'svg', outputPath: string): Promise<void> {
    // Validate format
    if (!['png', 'svg'].includes(format)) {
      throw new Error(`Invalid format: ${format}. Must be 'png' or 'svg'`);
    }

    // Ensure output directory exists
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Try Mermaid CLI first
    try {
      await this.exportWithMermaidCLI(diagram, format, outputPath);
      return;
    } catch (error) {
      // If Mermaid CLI fails, try Puppeteer
      try {
        await this.exportWithPuppeteer(diagram, format, outputPath);
        return;
      } catch (puppeteerError) {
        throw new Error(
          `Failed to export diagram: Mermaid CLI error: ${error}, Puppeteer error: ${puppeteerError}`
        );
      }
    }
  }

  /**
   * Exports diagram using Mermaid CLI
   * @param diagram - Mermaid diagram to export
   * @param format - Output format
   * @param outputPath - Output file path
   * @throws Error if Mermaid CLI is not available or export fails
   */
  private async exportWithMermaidCLI(
    diagram: MermaidDiagram,
    format: 'png' | 'svg',
    outputPath: string
  ): Promise<void> {
    // Check if Mermaid CLI is available
    try {
      execSync('mmdc --version', { stdio: 'pipe' });
    } catch {
      throw new Error('Mermaid CLI (mmdc) is not installed or not in PATH');
    }

    // Create temporary file for Mermaid syntax
    const tempDir = join(process.cwd(), '.mermaid-temp');
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    const tempMermaidFile = join(tempDir, `diagram-${Date.now()}.mmd`);
    writeFileSync(tempMermaidFile, diagram.syntax);

    try {
      // Build mmdc command
      const args = [
        '-i', tempMermaidFile,
        '-o', outputPath,
        '-t', this.options.theme || 'default',
      ];

      if (format === 'svg') {
        args.push('-s', 'svg');
      }

      if (this.options.width) {
        args.push('-w', this.options.width.toString());
      }

      if (this.options.height) {
        args.push('-H', this.options.height.toString());
      }

      // Execute mmdc command
      execSync(`mmdc ${args.join(' ')}`, { stdio: 'pipe' });
    } finally {
      // Clean up temporary file
      try {
        require('fs').unlinkSync(tempMermaidFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Exports diagram using Puppeteer as fallback
   * @param diagram - Mermaid diagram to export
   * @param format - Output format
   * @param outputPath - Output file path
   * @throws Error if Puppeteer is not available or export fails
   */
  private async exportWithPuppeteer(
    diagram: MermaidDiagram,
    format: 'png' | 'svg',
    outputPath: string
  ): Promise<void> {
    let puppeteer;
    try {
      puppeteer = require('puppeteer');
    } catch {
      throw new Error('Puppeteer is not installed. Install with: npm install puppeteer');
    }

    const browser = await puppeteer.launch({ headless: true });
    try {
      const page = await browser.newPage();

      // Set viewport size
      await page.setViewport({
        width: this.options.width || 1200,
        height: this.options.height || 800,
      });

      // Create HTML with Mermaid diagram
      const html = this.createMermaidHTML(diagram.syntax);

      // Load HTML into page
      await page.setContent(html, { waitUntil: 'networkidle0' });

      // Wait for Mermaid to render
      await page.waitForSelector('svg', { timeout: 5000 });

      // Take screenshot or save as SVG
      if (format === 'png') {
        await page.screenshot({ path: outputPath, fullPage: true });
      } else {
        // For SVG, we need to extract the SVG element
        // @ts-ignore - document is available in Puppeteer page context
        const svgContent = await page.evaluate(() => {
          const svg = document.querySelector('svg');
          return svg ? svg.outerHTML : '';
        });

        if (!svgContent) {
          throw new Error('Failed to extract SVG from rendered diagram');
        }

        writeFileSync(outputPath, svgContent);
      }
    } finally {
      await browser.close();
    }
  }

  /**
   * Creates an HTML document with embedded Mermaid diagram
   * @param mermaidSyntax - Mermaid diagram syntax
   * @returns string - HTML content
   */
  private createMermaidHTML(mermaidSyntax: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background-color: ${this.options.backgroundColor || '#ffffff'};
            font-family: Arial, sans-serif;
        }
        .mermaid {
            display: flex;
            justify-content: center;
            align-items: center;
        }
    </style>
</head>
<body>
    <div class="mermaid">
${mermaidSyntax}
    </div>
    <script>
        mermaid.initialize({ startOnLoad: true, theme: '${this.options.theme || 'default'}' });
        mermaid.contentLoaded();
    </script>
</body>
</html>
    `;
  }

  /**
   * Configures export options
   * @param options - Export options to apply
   */
  configure(options: ExportOptions): void {
    this.options = {
      ...this.options,
      ...options,
    };
  }
}
