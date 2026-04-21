import fs from 'fs/promises';
import path from 'path';
import { MermaidDiagram } from '../generators';
import { FileWriteError, OutputDirectoryError } from './errors';

/**
 * OutputWriter handles writing generated diagrams to files
 */
export class OutputWriter {
  /**
   * Writes a Mermaid diagram to architecture.md with metadata header
   * @param diagram - The generated Mermaid diagram
   * @param outputPath - Path where the file should be written (defaults to architecture.md)
   * @returns Promise<void>
   * @throws FileWriteError if the file cannot be written
   * @throws OutputDirectoryError if the output directory cannot be created
   */
  async write(diagram: MermaidDiagram, outputPath: string = 'architecture.md'): Promise<void> {
    // Ensure the output directory exists
    const outputDir = path.dirname(outputPath);
    if (outputDir && outputDir !== '.') {
      try {
        await fs.mkdir(outputDir, { recursive: true });
      } catch (error) {
        throw new OutputDirectoryError(outputDir, error instanceof Error ? error : new Error(String(error)));
      }
    }

    // Generate metadata header
    const header = this.generateHeader(diagram);

    // Wrap diagram syntax in proper markdown code block with mermaid language identifier
    const mermaidBlock = `\`\`\`mermaid\n${diagram.syntax}\n\`\`\``;

    // Combine header and diagram syntax with proper spacing
    const content = `${header}\n\n${mermaidBlock}\n`;

    // Write to file (overwrite if exists)
    try {
      await fs.writeFile(outputPath, content, 'utf-8');
    } catch (error) {
      throw new FileWriteError(outputPath, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Generates a metadata header for the output file
   * @param diagram - The generated Mermaid diagram
   * @returns string - Formatted header
   */
  private generateHeader(diagram: MermaidDiagram): string {
    const timestamp = diagram.metadata.generatedAt.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const lines = [
      '# Architecture Diagram',
      '',
      '> **Auto-generated documentation**',
      `> Generated at: ${timestamp}`,
      `> Nodes: ${diagram.metadata.nodeCount}`,
      `> Edges: ${diagram.metadata.edgeCount}`,
      '',
      '---',
    ];

    return lines.join('\n');
  }
}
