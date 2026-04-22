import { ASTParser } from './ASTParser';
import * as path from 'path';

describe('ASTParser Integration Tests', () => {
  const projectRoot = path.join(__dirname, '../../');
  const parser = new ASTParser(projectRoot);

  it('should parse FileDiscovery.ts from the project', async () => {
    const filePath = 'src/core/FileDiscovery.ts';
    const result = await parser.parse(filePath);

    // Verify basic structure
    expect(result.path).toBe(filePath);
    expect(result.imports.length).toBeGreaterThan(0);
    expect(result.exports.length).toBeGreaterThan(0);

    // Verify it found the glob import
    const globImport = result.imports.find(i => i.source === 'glob');
    expect(globImport).toBeDefined();
    expect(globImport?.isExternal).toBe(true);

    // Verify it found the FileDiscovery class export
    const classExport = result.exports.find(e => e.name === 'FileDiscovery');
    expect(classExport).toBeDefined();
    expect(classExport?.type).toBe('class');

    // Verify it found interface exports
    const interfaceExports = result.exports.filter(e => e.type === 'type');
    expect(interfaceExports.length).toBeGreaterThan(0);
  });

  it('should correctly identify external vs internal imports', async () => {
    const filePath = 'src/core/FileDiscovery.ts';
    const result = await parser.parse(filePath);

    const externalImports = result.imports.filter(i => i.isExternal);

    // Should have external imports (glob, path, fs)
    expect(externalImports.length).toBeGreaterThan(0);
    
    // External imports should include node modules
    const nodeModules = externalImports.map(i => i.source);
    expect(nodeModules).toContain('glob');
  });

  it('should parse the parsers index file', async () => {
    const filePath = 'src/parsers/index.ts';
    const result = await parser.parse(filePath);

    expect(result.path).toBe(filePath);
    
    // Should have exports (re-exports from ASTParser)
    expect(result.exports.length).toBeGreaterThan(0);
  });
});
