import { ASTParser } from './ASTParser';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('ASTParser', () => {
  let tempDir: string;
  let parser: ASTParser;

  beforeEach(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ast-parser-test-'));
    parser = new ASTParser(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('parse()', () => {
    it('should parse a simple TypeScript file with imports and exports', async () => {
      const testFile = path.join(tempDir, 'test.ts');
      const content = `
import { useState } from 'react';
import { helper } from './utils';

export function MyComponent() {
  return null;
}

export const myVariable = 42;
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('test.ts');

      expect(result.path).toBe('test.ts');
      expect(result.imports).toHaveLength(2);
      expect(result.exports).toHaveLength(2);
    });

    it('should handle files with no imports or exports', async () => {
      const testFile = path.join(tempDir, 'empty.ts');
      const content = `
const x = 1;
console.log(x);
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('empty.ts');

      expect(result.imports).toHaveLength(0);
      expect(result.exports).toHaveLength(0);
    });

    it('should throw error for non-existent file', async () => {
      await expect(parser.parse('non-existent.ts')).rejects.toThrow();
    });
  });

  describe('extractImports()', () => {
    it('should extract named imports', async () => {
      const testFile = path.join(tempDir, 'imports.ts');
      const content = `
import { foo, bar } from 'external-package';
import { baz } from './local-module';
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('imports.ts');

      expect(result.imports).toHaveLength(2);
      
      const externalImport = result.imports.find(i => i.source === 'external-package');
      expect(externalImport).toBeDefined();
      expect(externalImport?.isExternal).toBe(true);
      expect(externalImport?.specifiers).toEqual(['foo', 'bar']);

      const localImport = result.imports.find(i => i.source.includes('local-module'));
      expect(localImport).toBeDefined();
      expect(localImport?.isExternal).toBe(false);
    });

    it('should extract default imports', async () => {
      const testFile = path.join(tempDir, 'default-import.ts');
      const content = `
import React from 'react';
import MyComponent from './MyComponent';
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('default-import.ts');

      expect(result.imports).toHaveLength(2);
      expect(result.imports[0].specifiers).toEqual(['React']);
      expect(result.imports[1].specifiers).toEqual(['MyComponent']);
    });

    it('should extract namespace imports', async () => {
      const testFile = path.join(tempDir, 'namespace.ts');
      const content = `
import * as utils from './utils';
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('namespace.ts');

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].specifiers).toEqual(['utils']);
    });

    it('should handle require() calls', async () => {
      const testFile = path.join(tempDir, 'require.ts');
      const content = `
const fs = require('fs');
const helper = require('./helper');
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('require.ts');

      expect(result.imports).toHaveLength(2);
      expect(result.imports[0].source).toBe('fs');
      expect(result.imports[0].isExternal).toBe(true);
    });

    it('should mark external dependencies correctly', async () => {
      const testFile = path.join(tempDir, 'external.ts');
      const content = `
import { useState } from 'react';
import { Button } from '@/components/Button';
import { helper } from './helper';
import { util } from '../utils/util';
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('external.ts');

      expect(result.imports).toHaveLength(4);
      
      const reactImport = result.imports.find(i => i.source === 'react');
      expect(reactImport?.isExternal).toBe(true);

      const aliasImport = result.imports.find(i => i.source === 'components/Button.ts');
      expect(aliasImport?.isExternal).toBe(false);

      const relativeImports = result.imports.filter(i => !i.isExternal);
      expect(relativeImports).toHaveLength(3); // Now includes the @/ alias import
    });
  });

  describe('extractExports()', () => {
    it('should extract function exports', async () => {
      const testFile = path.join(tempDir, 'functions.ts');
      const content = `
export function foo() {}
export const bar = () => {};
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('functions.ts');

      expect(result.exports).toHaveLength(2);
      
      const fooExport = result.exports.find(e => e.name === 'foo');
      expect(fooExport?.type).toBe('function');
      expect(fooExport?.isDefault).toBe(false);

      const barExport = result.exports.find(e => e.name === 'bar');
      expect(barExport?.type).toBe('variable');
    });

    it('should extract class exports', async () => {
      const testFile = path.join(tempDir, 'classes.ts');
      const content = `
export class MyClass {}
export default class DefaultClass {}
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('classes.ts');

      expect(result.exports).toHaveLength(2);
      
      const namedClass = result.exports.find(e => e.name === 'MyClass');
      expect(namedClass?.type).toBe('class');
      expect(namedClass?.isDefault).toBe(false);

      const defaultClass = result.exports.find(e => e.name === 'DefaultClass');
      expect(defaultClass?.isDefault).toBe(true);
    });

    it('should extract variable exports', async () => {
      const testFile = path.join(tempDir, 'variables.ts');
      const content = `
export const API_URL = 'https://api.example.com';
export let counter = 0;
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('variables.ts');

      expect(result.exports).toHaveLength(2);
      expect(result.exports[0].type).toBe('variable');
      expect(result.exports[1].type).toBe('variable');
    });

    it('should extract named export declarations', async () => {
      const testFile = path.join(tempDir, 'named-exports.ts');
      const content = `
const foo = 1;
const bar = 2;
export { foo, bar };
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('named-exports.ts');

      expect(result.exports).toHaveLength(2);
      expect(result.exports.map(e => e.name)).toContain('foo');
      expect(result.exports.map(e => e.name)).toContain('bar');
    });

    it('should extract type and interface exports', async () => {
      const testFile = path.join(tempDir, 'types.ts');
      const content = `
export type MyType = string;
export interface MyInterface {
  name: string;
}
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('types.ts');

      expect(result.exports).toHaveLength(2);
      expect(result.exports[0].type).toBe('type');
      expect(result.exports[1].type).toBe('type');
    });

    it('should handle default exports', async () => {
      const testFile = path.join(tempDir, 'default.ts');
      const content = `
export default function MyComponent() {
  return null;
}
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('default.ts');

      expect(result.exports).toHaveLength(1);
      expect(result.exports[0].isDefault).toBe(true);
      expect(result.metadata.hasDefaultExport).toBe(true);
    });
  });

  describe('metadata extraction', () => {
    it('should detect React components', async () => {
      const testFile = path.join(tempDir, 'component.tsx');
      const content = `
import React from 'react';

export function MyComponent() {
  return <div>Hello</div>;
}
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('component.tsx');

      expect(result.metadata.isReactComponent).toBe(true);
    });

    it('should detect API routes', async () => {
      const apiDir = path.join(tempDir, 'app', 'api');
      await fs.mkdir(apiDir, { recursive: true });
      
      const testFile = path.join(apiDir, 'route.ts');
      const content = `
export async function GET() {
  return Response.json({ data: 'test' });
}
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('app/api/route.ts');

      expect(result.metadata.isApiRoute).toBe(true);
    });

    it('should detect default exports', async () => {
      const testFile = path.join(tempDir, 'default-export.ts');
      const content = `
export default class MyClass {}
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('default-export.ts');

      expect(result.metadata.hasDefaultExport).toBe(true);
    });
  });

  describe('relative import resolution', () => {
    it('should resolve relative imports to absolute paths', async () => {
      const subDir = path.join(tempDir, 'components');
      await fs.mkdir(subDir, { recursive: true });
      
      const testFile = path.join(subDir, 'Button.tsx');
      const content = `
import { helper } from '../utils/helper';
import { config } from './config';
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('components/Button.tsx');

      const helperImport = result.imports.find(i => i.source.includes('utils/helper'));
      expect(helperImport).toBeDefined();
      expect(helperImport?.isExternal).toBe(false);

      const configImport = result.imports.find(i => i.source.includes('components/config'));
      expect(configImport).toBeDefined();
      expect(configImport?.isExternal).toBe(false);
    });
  });

  describe('importKind classification', () => {
    it('should set importKind: named for named imports', async () => {
      const testFile = path.join(tempDir, 'named.ts');
      await fs.writeFile(testFile, `import { foo, bar } from './module';`);

      const result = await parser.parse('named.ts');

      expect(result.imports[0].importKind).toBe('named');
    });

    it('should set importKind: default for default imports', async () => {
      const testFile = path.join(tempDir, 'default-kind.ts');
      await fs.writeFile(testFile, `import React from 'react';`);

      const result = await parser.parse('default-kind.ts');

      expect(result.imports[0].importKind).toBe('default');
    });

    it('should set importKind: namespace for namespace imports', async () => {
      const testFile = path.join(tempDir, 'namespace-kind.ts');
      await fs.writeFile(testFile, `import * as utils from './utils';`);

      const result = await parser.parse('namespace-kind.ts');

      expect(result.imports[0].importKind).toBe('namespace');
    });

    it('should set importKind: side-effect for side-effect imports', async () => {
      const testFile = path.join(tempDir, 'side-effect.ts');
      await fs.writeFile(testFile, `import 'reflect-metadata';`);

      const result = await parser.parse('side-effect.ts');

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].importKind).toBe('side-effect');
      expect(result.imports[0].specifiers).toEqual([]);
      expect(result.imports[0].source).toBe('reflect-metadata');
      expect(result.imports[0].isExternal).toBe(true);
    });

    it('should set importKind: dynamic for dynamic imports', async () => {
      const testFile = path.join(tempDir, 'dynamic.ts');
      await fs.writeFile(testFile, `const mod = await import('./dynamic-module');`);

      const result = await parser.parse('dynamic.ts');

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].importKind).toBe('dynamic');
      expect(result.imports[0].source).toContain('dynamic-module');
    });

    it('should set importKind: require for require() calls', async () => {
      const testFile = path.join(tempDir, 'require-kind.ts');
      await fs.writeFile(testFile, `const fs = require('fs');`);

      const result = await parser.parse('require-kind.ts');

      expect(result.imports[0].importKind).toBe('require');
    });
  });

  describe('re-export with source', () => {
    it('should capture named re-exports as imports with importKind: named', async () => {
      const testFile = path.join(tempDir, 're-export-named.ts');
      await fs.writeFile(testFile, `export { foo, bar } from './other';`);

      const result = await parser.parse('re-export-named.ts');

      const reExport = result.imports.find(i => i.source.includes('other'));
      expect(reExport).toBeDefined();
      expect(reExport?.importKind).toBe('named');
      expect(reExport?.specifiers).toEqual(['foo', 'bar']);
    });

    it('should capture namespace re-exports as imports with importKind: namespace', async () => {
      const testFile = path.join(tempDir, 're-export-star.ts');
      await fs.writeFile(testFile, `export * from './other';`);

      const result = await parser.parse('re-export-star.ts');

      const reExport = result.imports.find(i => i.source.includes('other'));
      expect(reExport).toBeDefined();
      expect(reExport?.importKind).toBe('namespace');
    });

    it('should capture namespace-as re-exports with importKind: namespace', async () => {
      const testFile = path.join(tempDir, 're-export-ns.ts');
      await fs.writeFile(testFile, `export * as ns from './other';`);

      const result = await parser.parse('re-export-ns.ts');

      const reExport = result.imports.find(i => i.source.includes('other'));
      expect(reExport).toBeDefined();
      expect(reExport?.importKind).toBe('namespace');
    });
  });

  describe('@/ alias path resolution', () => {
    it('should not double-append extension for @/ alias with existing extension', async () => {
      const testFile = path.join(tempDir, 'alias-ext.ts');
      await fs.writeFile(testFile, `import { X } from '@/components/Button.tsx';`);

      const result = await parser.parse('alias-ext.ts');

      expect(result.imports[0].source).toBe('components/Button.tsx');
    });

    it('should append .ts for @/ alias without extension', async () => {
      const testFile = path.join(tempDir, 'alias-no-ext.ts');
      await fs.writeFile(testFile, `import { X } from '@/components/Button';`);

      const result = await parser.parse('alias-no-ext.ts');

      expect(result.imports[0].source).toBe('components/Button.ts');
    });
  });

  describe('external dependency detection', () => {
    it('should mark scoped packages as external', async () => {
      const testFile = path.join(tempDir, 'scoped-pkg.ts');
      await fs.writeFile(testFile, `import prisma from '@prisma/client';`);

      const result = await parser.parse('scoped-pkg.ts');

      expect(result.imports[0].isExternal).toBe(true);
      expect(result.imports[0].source).toBe('@prisma/client');
    });

    it('should mark @/ alias imports as internal', async () => {
      const testFile = path.join(tempDir, 'alias-internal.ts');
      await fs.writeFile(testFile, `import { Button } from '@/components/Button';`);

      const result = await parser.parse('alias-internal.ts');

      expect(result.imports[0].isExternal).toBe(false);
    });
  });

  // ─── Task 8.2: Enhanced import extraction tests ───────────────────────────

  describe('enhanced import extraction - mixed imports', () => {
    it('should handle mixed default + named imports', async () => {
      const testFile = path.join(tempDir, 'mixed-import.ts');
      await fs.writeFile(testFile, `import Foo, { bar, baz } from './module';`);

      const result = await parser.parse('mixed-import.ts');

      // Mixed import: default + named bindings
      // The parser records the default name and named specifiers separately
      // depending on which clause is processed last
      expect(result.imports).toHaveLength(1);
      const imp = result.imports[0];
      expect(imp.source).toContain('module');
      expect(imp.isExternal).toBe(false);
      // specifiers should include at least the named ones
      expect(imp.specifiers).toContain('bar');
      expect(imp.specifiers).toContain('baz');
    });

    it('should handle mixed default + namespace imports', async () => {
      const testFile = path.join(tempDir, 'mixed-ns.ts');
      await fs.writeFile(testFile, `import React, * as ReactAll from 'react';`);

      const result = await parser.parse('mixed-ns.ts');

      expect(result.imports).toHaveLength(1);
      const imp = result.imports[0];
      expect(imp.source).toBe('react');
      expect(imp.isExternal).toBe(true);
      // namespace binding name should be captured
      expect(imp.specifiers).toContain('ReactAll');
    });

    it('should handle multiple import statements from the same module', async () => {
      const testFile = path.join(tempDir, 'multi-import.ts');
      const content = `
import React from 'react';
import { useState, useEffect } from 'react';
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('multi-import.ts');

      expect(result.imports).toHaveLength(2);
      const reactImports = result.imports.filter(i => i.source === 'react');
      expect(reactImports).toHaveLength(2);
      expect(reactImports.every(i => i.isExternal)).toBe(true);
    });
  });

  describe('enhanced import extraction - path resolution', () => {
    it('should resolve sibling file imports to normalized paths', async () => {
      const testFile = path.join(tempDir, 'sibling.ts');
      await fs.writeFile(testFile, `import { x } from './other';`);

      const result = await parser.parse('sibling.ts');

      expect(result.imports[0].source).toBe('other.ts');
      expect(result.imports[0].isExternal).toBe(false);
    });

    it('should resolve parent directory imports correctly', async () => {
      const subDir = path.join(tempDir, 'sub');
      await fs.mkdir(subDir, { recursive: true });
      const testFile = path.join(subDir, 'child.ts');
      await fs.writeFile(testFile, `import { x } from '../shared';`);

      const result = await parser.parse('sub/child.ts');

      expect(result.imports[0].source).toBe('shared.ts');
      expect(result.imports[0].isExternal).toBe(false);
    });

    it('should resolve deeply nested relative imports', async () => {
      const deepDir = path.join(tempDir, 'a', 'b', 'c');
      await fs.mkdir(deepDir, { recursive: true });
      const testFile = path.join(deepDir, 'deep.ts');
      await fs.writeFile(testFile, `import { x } from '../../utils';`);

      const result = await parser.parse('a/b/c/deep.ts');

      expect(result.imports[0].source).toBe('a/utils.ts');
      expect(result.imports[0].isExternal).toBe(false);
    });

    it('should not append extension when import already has .ts extension', async () => {
      const testFile = path.join(tempDir, 'with-ext.ts');
      await fs.writeFile(testFile, `import { x } from './module.ts';`);

      const result = await parser.parse('with-ext.ts');

      expect(result.imports[0].source).toBe('module.ts');
      expect(result.imports[0].source.endsWith('.ts.ts')).toBe(false);
    });

    it('should not append extension when import already has .tsx extension', async () => {
      const testFile = path.join(tempDir, 'with-tsx.ts');
      await fs.writeFile(testFile, `import Component from './Button.tsx';`);

      const result = await parser.parse('with-tsx.ts');

      expect(result.imports[0].source).toBe('Button.tsx');
      expect(result.imports[0].source.endsWith('.tsx.ts')).toBe(false);
    });

    it('should preserve external module source unchanged', async () => {
      const testFile = path.join(tempDir, 'ext-source.ts');
      await fs.writeFile(testFile, `import axios from 'axios';`);

      const result = await parser.parse('ext-source.ts');

      expect(result.imports[0].source).toBe('axios');
    });
  });

  describe('enhanced import extraction - external dependency detection', () => {
    it('should detect bare module specifiers as external', async () => {
      const testFile = path.join(tempDir, 'bare.ts');
      const content = `
import lodash from 'lodash';
import express from 'express';
import zod from 'zod';
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('bare.ts');

      expect(result.imports).toHaveLength(3);
      expect(result.imports.every(i => i.isExternal)).toBe(true);
    });

    it('should detect scoped npm packages as external', async () => {
      const testFile = path.join(tempDir, 'scoped.ts');
      const content = `
import { PrismaClient } from '@prisma/client';
import { NextRequest } from '@next/server';
import { Button } from '@radix-ui/react-button';
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('scoped.ts');

      expect(result.imports).toHaveLength(3);
      expect(result.imports.every(i => i.isExternal)).toBe(true);
      expect(result.imports.map(i => i.source)).toContain('@prisma/client');
      expect(result.imports.map(i => i.source)).toContain('@next/server');
      expect(result.imports.map(i => i.source)).toContain('@radix-ui/react-button');
    });

    it('should detect Node.js built-in modules as external', async () => {
      const testFile = path.join(tempDir, 'builtins.ts');
      const content = `
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('builtins.ts');

      expect(result.imports).toHaveLength(3);
      expect(result.imports.every(i => i.isExternal)).toBe(true);
    });

    it('should detect relative imports starting with ./ as internal', async () => {
      const testFile = path.join(tempDir, 'relative-dot.ts');
      await fs.writeFile(testFile, `import { x } from './local';`);

      const result = await parser.parse('relative-dot.ts');

      expect(result.imports[0].isExternal).toBe(false);
    });

    it('should detect relative imports starting with ../ as internal', async () => {
      const subDir = path.join(tempDir, 'sub');
      await fs.mkdir(subDir, { recursive: true });
      const testFile = path.join(subDir, 'file.ts');
      await fs.writeFile(testFile, `import { x } from '../parent';`);

      const result = await parser.parse('sub/file.ts');

      expect(result.imports[0].isExternal).toBe(false);
    });

    it('should detect @/ alias imports as internal (not node_modules)', async () => {
      const testFile = path.join(tempDir, 'alias-check.ts');
      const content = `
import { helper } from '@/lib/helper';
import { Button } from '@/components/ui/Button';
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('alias-check.ts');

      expect(result.imports).toHaveLength(2);
      expect(result.imports.every(i => !i.isExternal)).toBe(true);
    });

    it('should correctly separate external from internal in a mixed file', async () => {
      const testFile = path.join(tempDir, 'mixed-ext.ts');
      const content = `
import React from 'react';
import { useState } from 'react';
import axios from 'axios';
import { helper } from './helper';
import { util } from '../utils';
import { Button } from '@/components/Button';
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('mixed-ext.ts');

      const external = result.imports.filter(i => i.isExternal);
      const internal = result.imports.filter(i => !i.isExternal);

      expect(external).toHaveLength(3); // react, react, axios
      expect(internal).toHaveLength(3); // ./helper, ../utils, @/components/Button
    });
  });

  describe('enhanced import extraction - re-exports', () => {
    it('should capture named re-exports: export { foo } from "./module"', async () => {
      const testFile = path.join(tempDir, 're-named.ts');
      await fs.writeFile(testFile, `export { foo } from './module';`);

      const result = await parser.parse('re-named.ts');

      const reExport = result.imports.find(i => i.source.includes('module'));
      expect(reExport).toBeDefined();
      expect(reExport!.specifiers).toEqual(['foo']);
      expect(reExport!.importKind).toBe('named');
      expect(reExport!.isExternal).toBe(false);
    });

    it('should capture multiple named re-exports', async () => {
      const testFile = path.join(tempDir, 're-multi.ts');
      await fs.writeFile(testFile, `export { foo, bar, baz } from './module';`);

      const result = await parser.parse('re-multi.ts');

      const reExport = result.imports.find(i => i.source.includes('module'));
      expect(reExport).toBeDefined();
      expect(reExport!.specifiers).toEqual(['foo', 'bar', 'baz']);
    });

    it('should capture wildcard re-exports: export * from "./module"', async () => {
      const testFile = path.join(tempDir, 're-star.ts');
      await fs.writeFile(testFile, `export * from './module';`);

      const result = await parser.parse('re-star.ts');

      const reExport = result.imports.find(i => i.source.includes('module'));
      expect(reExport).toBeDefined();
      expect(reExport!.importKind).toBe('namespace');
    });

    it('should capture namespace re-exports: export * as ns from "./module"', async () => {
      const testFile = path.join(tempDir, 're-ns.ts');
      await fs.writeFile(testFile, `export * as utils from './module';`);

      const result = await parser.parse('re-ns.ts');

      const reExport = result.imports.find(i => i.source.includes('module'));
      expect(reExport).toBeDefined();
      expect(reExport!.importKind).toBe('namespace');
      expect(reExport!.specifiers).toContain('utils');
    });

    it('should capture re-exports from external packages', async () => {
      const testFile = path.join(tempDir, 're-external.ts');
      await fs.writeFile(testFile, `export { useState, useEffect } from 'react';`);

      const result = await parser.parse('re-external.ts');

      const reExport = result.imports.find(i => i.source === 'react');
      expect(reExport).toBeDefined();
      expect(reExport!.isExternal).toBe(true);
      expect(reExport!.specifiers).toEqual(['useState', 'useEffect']);
    });

    it('should handle index barrel file with multiple re-exports', async () => {
      const testFile = path.join(tempDir, 'index.ts');
      const content = `
export { Button } from './Button';
export { Input } from './Input';
export * from './types';
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('index.ts');

      const reExports = result.imports.filter(i => !i.isExternal);
      expect(reExports).toHaveLength(3);
      expect(reExports.map(i => i.source)).toContain('Button.ts');
      expect(reExports.map(i => i.source)).toContain('Input.ts');
    });
  });

  // ─── Task 11.2: External call detection tests ─────────────────────────────

  describe('detectExternalCalls() - fetch()', () => {
    it('should detect a simple fetch() call', async () => {
      const testFile = path.join(tempDir, 'fetch-simple.ts');
      await fs.writeFile(testFile, `fetch('https://api.example.com/data');`);

      const result = await parser.parse('fetch-simple.ts');

      expect(result.externalCalls).toHaveLength(1);
      expect(result.externalCalls[0].type).toBe('fetch');
      expect(result.externalCalls[0].target).toBe('https://api.example.com/data');
    });

    it('should detect fetch() with no string literal URL', async () => {
      const testFile = path.join(tempDir, 'fetch-dynamic.ts');
      await fs.writeFile(testFile, `const url = '/api/data'; fetch(url);`);

      const result = await parser.parse('fetch-dynamic.ts');

      expect(result.externalCalls).toHaveLength(1);
      expect(result.externalCalls[0].type).toBe('fetch');
      expect(result.externalCalls[0].target).toBe(''); // no string literal
    });

    it('should detect fetch() with options argument', async () => {
      const testFile = path.join(tempDir, 'fetch-options.ts');
      const content = `
fetch('https://api.example.com/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
});
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('fetch-options.ts');

      expect(result.externalCalls).toHaveLength(1);
      expect(result.externalCalls[0].type).toBe('fetch');
      expect(result.externalCalls[0].target).toBe('https://api.example.com/users');
    });

    it('should detect multiple fetch() calls', async () => {
      const testFile = path.join(tempDir, 'fetch-multiple.ts');
      const content = `
fetch('https://api.example.com/users');
fetch('https://api.example.com/posts');
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('fetch-multiple.ts');

      expect(result.externalCalls).toHaveLength(2);
      expect(result.externalCalls.every(c => c.type === 'fetch')).toBe(true);
      expect(result.externalCalls.map(c => c.target)).toContain('https://api.example.com/users');
      expect(result.externalCalls.map(c => c.target)).toContain('https://api.example.com/posts');
    });

    it('should include source location for fetch() calls', async () => {
      const testFile = path.join(tempDir, 'fetch-location.ts');
      await fs.writeFile(testFile, `fetch('https://api.example.com');`);

      const result = await parser.parse('fetch-location.ts');

      expect(result.externalCalls[0].location).toBeDefined();
      expect(result.externalCalls[0].location.line).toBeGreaterThan(0);
    });
  });

  describe('detectExternalCalls() - axios', () => {
    it('should detect axios.get() call', async () => {
      const testFile = path.join(tempDir, 'axios-get.ts');
      const content = `
import axios from 'axios';
axios.get('https://api.example.com/data');
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('axios-get.ts');

      const axiosCalls = result.externalCalls.filter(c => c.type === 'axios');
      expect(axiosCalls).toHaveLength(1);
      expect(axiosCalls[0].target).toBe('https://api.example.com/data');
    });

    it('should detect axios.post() call', async () => {
      const testFile = path.join(tempDir, 'axios-post.ts');
      const content = `
import axios from 'axios';
axios.post('https://api.example.com/users', { name: 'test' });
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('axios-post.ts');

      const axiosCalls = result.externalCalls.filter(c => c.type === 'axios');
      expect(axiosCalls).toHaveLength(1);
      expect(axiosCalls[0].target).toBe('https://api.example.com/users');
    });

    it('should detect axios() called directly', async () => {
      const testFile = path.join(tempDir, 'axios-direct.ts');
      const content = `
import axios from 'axios';
axios('https://api.example.com/data');
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('axios-direct.ts');

      const axiosCalls = result.externalCalls.filter(c => c.type === 'axios');
      expect(axiosCalls).toHaveLength(1);
      expect(axiosCalls[0].target).toBe('https://api.example.com/data');
    });

    it('should detect multiple axios method variants', async () => {
      const testFile = path.join(tempDir, 'axios-methods.ts');
      const content = `
import axios from 'axios';
axios.get('/api/users');
axios.post('/api/users');
axios.put('/api/users/1');
axios.delete('/api/users/1');
axios.patch('/api/users/1');
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('axios-methods.ts');

      const axiosCalls = result.externalCalls.filter(c => c.type === 'axios');
      expect(axiosCalls).toHaveLength(5);
    });
  });

  describe('detectExternalCalls() - database clients', () => {
    it('should detect new PrismaClient() instantiation', async () => {
      const testFile = path.join(tempDir, 'prisma-new.ts');
      const content = `
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('prisma-new.ts');

      const dbCalls = result.externalCalls.filter(c => c.type === 'database');
      expect(dbCalls.length).toBeGreaterThan(0);
      expect(dbCalls.some(c => c.target === 'prisma')).toBe(true);
    });

    it('should detect prisma.* method calls', async () => {
      const testFile = path.join(tempDir, 'prisma-usage.ts');
      const content = `
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const users = await prisma.user.findMany();
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('prisma-usage.ts');

      const dbCalls = result.externalCalls.filter(c => c.type === 'database');
      expect(dbCalls.length).toBeGreaterThan(0);
    });

    it('should detect mongoose usage', async () => {
      const testFile = path.join(tempDir, 'mongoose-usage.ts');
      const content = `
import mongoose from 'mongoose';
mongoose.connect('mongodb://localhost:27017/mydb');
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('mongoose-usage.ts');

      const dbCalls = result.externalCalls.filter(c => c.type === 'database');
      expect(dbCalls.length).toBeGreaterThan(0);
      expect(dbCalls.some(c => c.target === 'mongoose')).toBe(true);
    });

    it('should detect new MongoClient() instantiation', async () => {
      const testFile = path.join(tempDir, 'mongo-new.ts');
      const content = `
import { MongoClient } from 'mongodb';
const client = new MongoClient('mongodb://localhost:27017');
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('mongo-new.ts');

      const dbCalls = result.externalCalls.filter(c => c.type === 'database');
      expect(dbCalls.length).toBeGreaterThan(0);
      expect(dbCalls.some(c => c.target === 'mongodb')).toBe(true);
    });

    it('should return empty array when no external calls exist', async () => {
      const testFile = path.join(tempDir, 'no-calls.ts');
      const content = `
const x = 1 + 2;
console.log(x);
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('no-calls.ts');

      expect(result.externalCalls).toHaveLength(0);
    });

    it('should detect new Sequelize() instantiation', async () => {
      const testFile = path.join(tempDir, 'sequelize-new.ts');
      const content = `
import { Sequelize } from 'sequelize';
const sequelize = new Sequelize('postgres://user:pass@localhost:5432/mydb');
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('sequelize-new.ts');

      const dbCalls = result.externalCalls.filter(c => c.type === 'database');
      expect(dbCalls.length).toBeGreaterThan(0);
      expect(dbCalls.some(c => c.target === 'sequelize')).toBe(true);
    });

    it('should detect pg Pool instantiation', async () => {
      const testFile = path.join(tempDir, 'pg-pool.ts');
      const content = `
import { Pool } from 'pg';
const pool = new Pool({ connectionString: 'postgres://localhost/mydb' });
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('pg-pool.ts');

      const dbCalls = result.externalCalls.filter(c => c.type === 'database');
      expect(dbCalls.length).toBeGreaterThan(0);
    });

    it('should detect db.* method calls (common db variable name)', async () => {
      const testFile = path.join(tempDir, 'db-usage.ts');
      const content = `
const db = getDatabase();
const result = await db.query('SELECT * FROM users');
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('db-usage.ts');

      const dbCalls = result.externalCalls.filter(c => c.type === 'database');
      expect(dbCalls.length).toBeGreaterThan(0);
      expect(dbCalls.some(c => c.target === 'db')).toBe(true);
    });

    it('should detect database calls from imported client identifiers', async () => {
      const testFile = path.join(tempDir, 'prisma-client-import.ts');
      const content = `
import { PrismaClient } from '@prisma/client';
const client = new PrismaClient();
const users = await client.user.findMany();
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('prisma-client-import.ts');

      const dbCalls = result.externalCalls.filter(c => c.type === 'database');
      expect(dbCalls.length).toBeGreaterThan(0);
    });
  });

  describe('detectExternalCalls() - axios additional methods', () => {
    it('should detect axios.head() call', async () => {
      const testFile = path.join(tempDir, 'axios-head.ts');
      const content = `
import axios from 'axios';
axios.head('https://api.example.com/health');
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('axios-head.ts');

      const axiosCalls = result.externalCalls.filter(c => c.type === 'axios');
      expect(axiosCalls).toHaveLength(1);
      expect(axiosCalls[0].target).toBe('https://api.example.com/health');
    });

    it('should detect axios.options() call', async () => {
      const testFile = path.join(tempDir, 'axios-options.ts');
      const content = `
import axios from 'axios';
axios.options('https://api.example.com/resource');
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('axios-options.ts');

      const axiosCalls = result.externalCalls.filter(c => c.type === 'axios');
      expect(axiosCalls).toHaveLength(1);
    });

    it('should detect axios.request() call', async () => {
      const testFile = path.join(tempDir, 'axios-request.ts');
      const content = `
import axios from 'axios';
axios.request({ url: 'https://api.example.com/data', method: 'GET' });
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('axios-request.ts');

      const axiosCalls = result.externalCalls.filter(c => c.type === 'axios');
      expect(axiosCalls).toHaveLength(1);
      // No string literal as first arg, so target is empty
      expect(axiosCalls[0].target).toBe('');
    });

    it('should detect axios.create() call', async () => {
      const testFile = path.join(tempDir, 'axios-create.ts');
      const content = `
import axios from 'axios';
const client = axios.create({ baseURL: 'https://api.example.com' });
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('axios-create.ts');

      const axiosCalls = result.externalCalls.filter(c => c.type === 'axios');
      expect(axiosCalls).toHaveLength(1);
    });
  });

  describe('detectExternalCalls() - URL/identifier extraction', () => {
    it('should extract full HTTPS URL from fetch()', async () => {
      const testFile = path.join(tempDir, 'url-https.ts');
      await fs.writeFile(testFile, `fetch('https://api.openweathermap.org/data/2.5/weather');`);

      const result = await parser.parse('url-https.ts');

      expect(result.externalCalls[0].target).toBe('https://api.openweathermap.org/data/2.5/weather');
    });

    it('should extract relative path URL from fetch()', async () => {
      const testFile = path.join(tempDir, 'url-relative.ts');
      await fs.writeFile(testFile, `fetch('/api/users');`);

      const result = await parser.parse('url-relative.ts');

      expect(result.externalCalls[0].target).toBe('/api/users');
    });

    it('should return empty string target when URL is a variable', async () => {
      const testFile = path.join(tempDir, 'url-variable.ts');
      const content = `
const endpoint = process.env.API_URL;
fetch(endpoint);
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('url-variable.ts');

      expect(result.externalCalls[0].type).toBe('fetch');
      expect(result.externalCalls[0].target).toBe('');
    });

    it('should extract URL from axios.get() as target', async () => {
      const testFile = path.join(tempDir, 'url-axios.ts');
      await fs.writeFile(testFile, `import axios from 'axios'; axios.get('https://service.example.com/v1/data');`);

      const result = await parser.parse('url-axios.ts');

      const axiosCalls = result.externalCalls.filter(c => c.type === 'axios');
      expect(axiosCalls[0].target).toBe('https://service.example.com/v1/data');
    });

    it('should extract database identifier as target for prisma calls', async () => {
      const testFile = path.join(tempDir, 'db-identifier.ts');
      const content = `
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
await prisma.user.findMany();
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('db-identifier.ts');

      const dbCalls = result.externalCalls.filter(c => c.type === 'database');
      expect(dbCalls.some(c => c.target === 'prisma')).toBe(true);
    });

    it('should include correct line number in location', async () => {
      const testFile = path.join(tempDir, 'location-line.ts');
      const content = `// line 1
// line 2
fetch('https://api.example.com'); // line 3
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('location-line.ts');

      expect(result.externalCalls[0].location.line).toBe(3);
    });
  });

  describe('detectExternalCalls() - mixed calls', () => {
    it('should detect fetch and axios calls in the same file', async () => {
      const testFile = path.join(tempDir, 'mixed-calls.ts');
      const content = `
import axios from 'axios';
fetch('https://api.example.com/data');
axios.get('https://other-service.com/info');
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('mixed-calls.ts');

      const fetchCalls = result.externalCalls.filter(c => c.type === 'fetch');
      const axiosCalls = result.externalCalls.filter(c => c.type === 'axios');
      expect(fetchCalls).toHaveLength(1);
      expect(axiosCalls).toHaveLength(1);
    });

    it('should detect fetch, axios, and database calls in the same file', async () => {
      const testFile = path.join(tempDir, 'all-calls.ts');
      const content = `
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
fetch('https://api.example.com/weather');
axios.post('https://api.example.com/events', {});
const users = await prisma.user.findMany();
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('all-calls.ts');

      const fetchCalls = result.externalCalls.filter(c => c.type === 'fetch');
      const axiosCalls = result.externalCalls.filter(c => c.type === 'axios');
      const dbCalls = result.externalCalls.filter(c => c.type === 'database');
      expect(fetchCalls.length).toBeGreaterThan(0);
      expect(axiosCalls.length).toBeGreaterThan(0);
      expect(dbCalls.length).toBeGreaterThan(0);
    });

    it('should not produce false positives for non-external function calls', async () => {
      const testFile = path.join(tempDir, 'no-false-positives.ts');
      const content = `
function fetchData() { return 42; }
const result = fetchData();
const obj = { get: () => 'value' };
obj.get();
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse('no-false-positives.ts');

      // fetchData() is not a fetch() call, obj.get() is not axios.get()
      const fetchCalls = result.externalCalls.filter(c => c.type === 'fetch');
      const axiosCalls = result.externalCalls.filter(c => c.type === 'axios');
      expect(fetchCalls).toHaveLength(0);
      expect(axiosCalls).toHaveLength(0);
    });
  });
});
