/**
 * Architecture Diagram Generator
 * Main entry point for library usage
 */

export * from './core';
export * from './parsers';
export * from './generators';
export * from './plugins';
export * from './utils';

// Re-export VisualExporter explicitly if not in generators/index.ts
export { VisualExporter } from './generators/VisualExporter';
export type { ExportOptions } from './generators/VisualExporter';
