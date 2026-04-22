import { FileDiscovery, ProjectConfig } from './FileDiscovery';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('FileDiscovery', () => {
  let fileDiscovery: FileDiscovery;
  let tempDir: string;

  beforeEach(() => {
    fileDiscovery = new FileDiscovery();
  });

  afterEach(async () => {
    // Clean up temp directory if it was created
    if (tempDir && tempDir.startsWith(os.tmpdir())) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  /**
   * Helper function to create a temporary directory structure
   */
  async function createTempStructure(structure: Record<string, string>): Promise<string> {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-discovery-'));

    for (const [filePath, content] of Object.entries(structure)) {
      const fullPath = path.join(tempDir, filePath);
      const dir = path.dirname(fullPath);

      // Create directories if they don't exist
      await fs.mkdir(dir, { recursive: true });

      // Write file
      await fs.writeFile(fullPath, content);
    }

    return tempDir;
  }

  describe('discover()', () => {
    it('should discover files in /app directory', async () => {
      const structure = {
        'app/page.tsx': 'export default function Home() {}',
        'app/layout.tsx': 'export default function Layout() {}',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = { rootDir };

      const result = await fileDiscovery.discover(rootDir, config);

      expect(result.routes).toContain('app/page.tsx');
      expect(result.routes).toContain('app/layout.tsx');
    });

    it('should discover API routes in /app/api directory', async () => {
      const structure = {
        'app/api/users/route.ts': 'export async function GET() {}',
        'app/api/posts/route.ts': 'export async function POST() {}',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = { rootDir };

      const result = await fileDiscovery.discover(rootDir, config);

      expect(result.api).toContain('app/api/users/route.ts');
      expect(result.api).toContain('app/api/posts/route.ts');
    });

    it('should discover components in /app directory', async () => {
      const structure = {
        'app/components/Header.tsx': 'export function Header() {}',
        'app/components/Footer.tsx': 'export function Footer() {}',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = { rootDir };

      const result = await fileDiscovery.discover(rootDir, config);

      expect(result.components).toContain('app/components/Header.tsx');
      expect(result.components).toContain('app/components/Footer.tsx');
    });

    it('should discover utilities in /src directory', async () => {
      const structure = {
        'src/utils/helpers.ts': 'export function helper() {}',
        'src/utils/constants.ts': 'export const CONSTANT = 1;',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = { rootDir };

      const result = await fileDiscovery.discover(rootDir, config);

      expect(result.utilities).toContain('src/utils/helpers.ts');
      expect(result.utilities).toContain('src/utils/constants.ts');
    });

    it('should ignore node_modules directory', async () => {
      const structure = {
        'app/page.tsx': 'export default function Home() {}',
        'node_modules/package/index.ts': 'export default {}',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = { rootDir };

      const result = await fileDiscovery.discover(rootDir, config);

      expect(result.routes).toContain('app/page.tsx');
      expect(result.routes.length).toBeGreaterThan(0);
      // node_modules should not be included
      const allFiles = [
        ...result.routes,
        ...result.api,
        ...result.components,
        ...result.utilities,
        ...(result.config || []),
      ];
      expect(allFiles.some((f) => f.includes('node_modules'))).toBe(false);
    });

    it('should ignore .next directory', async () => {
      const structure = {
        'app/page.tsx': 'export default function Home() {}',
        '.next/build/index.js': 'export default {}',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = { rootDir };

      const result = await fileDiscovery.discover(rootDir, config);

      expect(result.routes).toContain('app/page.tsx');
      const allFiles = [
        ...result.routes,
        ...result.api,
        ...result.components,
        ...result.utilities,
        ...(result.config || []),
      ];
      expect(allFiles.some((f) => f.includes('.next'))).toBe(false);
    });

    it('should handle non-existent directories gracefully', async () => {
      const structure = {
        'app/page.tsx': 'export default function Home() {}',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = { rootDir };

      // Should not throw error even if /pages, /api, /src don't exist
      const result = await fileDiscovery.discover(rootDir, config);

      expect(result.routes).toContain('app/page.tsx');
      expect(result).toHaveProperty('api');
      expect(result).toHaveProperty('components');
      expect(result).toHaveProperty('utilities');
    });

    it('should return FileList with all required properties', async () => {
      const structure = {
        'app/page.tsx': 'export default function Home() {}',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = { rootDir };

      const result = await fileDiscovery.discover(rootDir, config);

      expect(result).toHaveProperty('routes');
      expect(result).toHaveProperty('api');
      expect(result).toHaveProperty('components');
      expect(result).toHaveProperty('utilities');
      expect(Array.isArray(result.routes)).toBe(true);
      expect(Array.isArray(result.api)).toBe(true);
      expect(Array.isArray(result.components)).toBe(true);
      expect(Array.isArray(result.utilities)).toBe(true);
    });
  });

  describe('filter()', () => {
    it('should filter files matching include patterns', () => {
      const files = [
        'app/page.tsx',
        'app/layout.tsx',
        'app/api/users/route.ts',
        'src/utils/helpers.ts',
      ];

      const patterns = ['app/**'];
      const result = fileDiscovery.filter(files, patterns);

      expect(result).toContain('app/page.tsx');
      expect(result).toContain('app/layout.tsx');
      expect(result).toContain('app/api/users/route.ts');
      expect(result).not.toContain('src/utils/helpers.ts');
    });

    it('should support multiple include patterns', () => {
      const files = [
        'app/page.tsx',
        'app/layout.tsx',
        'src/utils/helpers.ts',
        'src/config/constants.ts',
      ];

      const patterns = ['app/**', 'src/utils/**'];
      const result = fileDiscovery.filter(files, patterns);

      expect(result).toContain('app/page.tsx');
      expect(result).toContain('app/layout.tsx');
      expect(result).toContain('src/utils/helpers.ts');
      expect(result).not.toContain('src/config/constants.ts');
    });

    it('should return all files when patterns is empty', () => {
      const files = [
        'app/page.tsx',
        'app/layout.tsx',
        'src/utils/helpers.ts',
      ];

      const result = fileDiscovery.filter(files, []);

      expect(result).toEqual(files);
    });

    it('should return empty array when no files match patterns', () => {
      const files = [
        'app/page.tsx',
        'app/layout.tsx',
      ];

      const patterns = ['src/**'];
      const result = fileDiscovery.filter(files, patterns);

      expect(result).toEqual([]);
    });

    it('should support wildcard patterns', () => {
      const files = [
        'app/page.tsx',
        'app/layout.tsx',
        'app/api/users/route.ts',
      ];

      const patterns = ['app/**/*.tsx'];
      const result = fileDiscovery.filter(files, patterns);

      expect(result).toContain('app/page.tsx');
      expect(result).toContain('app/layout.tsx');
      expect(result).not.toContain('app/api/users/route.ts');
    });
  });

  describe('file categorization', () => {
    it('should categorize page files as routes', async () => {
      const structure = {
        'app/page.tsx': 'export default function Home() {}',
        'app/dashboard/page.tsx': 'export default function Dashboard() {}',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = { rootDir };

      const result = await fileDiscovery.discover(rootDir, config);

      expect(result.routes).toContain('app/page.tsx');
      expect(result.routes).toContain('app/dashboard/page.tsx');
    });

    it('should categorize API route files as api', async () => {
      const structure = {
        'app/api/users/route.ts': 'export async function GET() {}',
        'app/api/posts/[id]/route.ts': 'export async function GET() {}',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = { rootDir };

      const result = await fileDiscovery.discover(rootDir, config);

      expect(result.api).toContain('app/api/users/route.ts');
      expect(result.api).toContain('app/api/posts/[id]/route.ts');
    });

    it('should categorize component files as components', async () => {
      const structure = {
        'app/components/Header.tsx': 'export function Header() {}',
        'app/dashboard/_components/Card.tsx': 'export function Card() {}',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = { rootDir };

      const result = await fileDiscovery.discover(rootDir, config);

      expect(result.components).toContain('app/components/Header.tsx');
      expect(result.components).toContain('app/dashboard/_components/Card.tsx');
    });

    it('should categorize config files as config', async () => {
      const structure = {
        'src/config/database.ts': 'export const db = {};',
        'src/constants.ts': 'export const CONSTANT = 1;',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = { rootDir };

      const result = await fileDiscovery.discover(rootDir, config);

      expect(result.config).toContain('src/config/database.ts');
      expect(result.config).toContain('src/constants.ts');
    });

    it('should categorize utility files as utilities', async () => {
      const structure = {
        'src/utils/helpers.ts': 'export function helper() {}',
        'src/lib/parser.ts': 'export function parse() {}',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = { rootDir };

      const result = await fileDiscovery.discover(rootDir, config);

      expect(result.utilities).toContain('src/utils/helpers.ts');
      expect(result.utilities).toContain('src/lib/parser.ts');
    });
  });

  describe('exclude patterns', () => {
    it('should respect custom exclude patterns', async () => {
      const structure = {
        'app/page.tsx': 'export default function Home() {}',
        'app/test.spec.tsx': 'describe("test", () => {})',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = {
        rootDir,
        exclude: ['**/*.spec.tsx'],
      };

      const result = await fileDiscovery.discover(rootDir, config);

      expect(result.routes).toContain('app/page.tsx');
      expect(result.routes).not.toContain('app/test.spec.tsx');
    });

    it('should exclude multiple patterns', async () => {
      const structure = {
        'app/page.tsx': 'export default function Home() {}',
        'app/test.spec.tsx': 'describe("test", () => {})',
        'app/test.test.tsx': 'describe("test", () => {})',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = {
        rootDir,
        exclude: ['**/*.spec.tsx', '**/*.test.tsx'],
      };

      const result = await fileDiscovery.discover(rootDir, config);

      expect(result.routes).toContain('app/page.tsx');
      expect(result.routes).not.toContain('app/test.spec.tsx');
      expect(result.routes).not.toContain('app/test.test.tsx');
    });
  });

  describe('combined include and exclude patterns', () => {
    it('should apply both include and exclude patterns', async () => {
      const structure = {
        'app/page.tsx': 'export default function Home() {}',
        'app/dashboard/page.tsx': 'export default function Dashboard() {}',
        'app/dashboard/page.spec.tsx': 'describe("test", () => {})',
        'src/utils/helpers.ts': 'export function helper() {}',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = {
        rootDir,
        include: ['app/**'],
        exclude: ['**/*.spec.tsx'],
      };

      const result = await fileDiscovery.discover(rootDir, config);

      expect(result.routes).toContain('app/page.tsx');
      expect(result.routes).toContain('app/dashboard/page.tsx');
      expect(result.routes).not.toContain('app/dashboard/page.spec.tsx');
      expect(result.utilities).not.toContain('src/utils/helpers.ts');
    });
  });

  describe('edge cases for file categorization', () => {
    it('should handle deeply nested directory structures', async () => {
      const structure = {
        'app/dashboard/analytics/reports/page.tsx': 'export default function Reports() {}',
        'app/api/v1/users/[id]/route.ts': 'export async function GET() {}',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = { rootDir };

      const result = await fileDiscovery.discover(rootDir, config);

      expect(result.routes).toContain('app/dashboard/analytics/reports/page.tsx');
      expect(result.api).toContain('app/api/v1/users/[id]/route.ts');
    });

    it('should handle files with multiple dots in name', async () => {
      const structure = {
        'src/utils/date.utils.ts': 'export function formatDate() {}',
        'src/config/app.config.ts': 'export const config = {};',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = { rootDir };

      const result = await fileDiscovery.discover(rootDir, config);

      expect(result.utilities).toContain('src/utils/date.utils.ts');
      expect(result.config).toContain('src/config/app.config.ts');
    });

    it('should handle JavaScript files (.js, .jsx)', async () => {
      const structure = {
        'app/page.js': 'export default function Home() {}',
        'app/api/users/route.js': 'export async function GET() {}',
        'src/utils/helpers.js': 'export function helper() {}',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = { rootDir };

      const result = await fileDiscovery.discover(rootDir, config);

      expect(result.routes).toContain('app/page.js');
      expect(result.api).toContain('app/api/users/route.js');
      expect(result.utilities).toContain('src/utils/helpers.js');
    });

    it('should prioritize utils/helpers categorization over config', async () => {
      const structure = {
        'src/utils/config-helpers.ts': 'export function getConfig() {}',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = { rootDir };

      const result = await fileDiscovery.discover(rootDir, config);

      // Should be categorized as utilities because utils pattern is checked first
      expect(result.utilities).toContain('src/utils/config-helpers.ts');
    });

    it('should handle /pages directory (legacy Next.js)', async () => {
      const structure = {
        'pages/index.tsx': 'export default function Home() {}',
        'pages/api/users.ts': 'export default async function handler() {}',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = { rootDir };

      const result = await fileDiscovery.discover(rootDir, config);

      expect(result.routes).toContain('pages/index.tsx');
      expect(result.api).toContain('pages/api/users.ts');
    });

    it('should handle /api directory (legacy structure)', async () => {
      const structure = {
        'api/users/route.ts': 'export async function GET() {}',
        'api/posts/route.ts': 'export async function POST() {}',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = { rootDir };

      const result = await fileDiscovery.discover(rootDir, config);

      expect(result.api).toContain('api/users/route.ts');
      expect(result.api).toContain('api/posts/route.ts');
    });
  });

  describe('filter() with complex patterns', () => {
    it('should handle patterns with question marks', () => {
      const files = [
        'app/page.tsx',
        'app/pa.tsx',
        'app/pages.tsx',
      ];

      const patterns = ['app/pa?e.tsx'];
      const result = fileDiscovery.filter(files, patterns);

      expect(result).toContain('app/page.tsx');
      expect(result).not.toContain('app/pa.tsx');
      expect(result).not.toContain('app/pages.tsx');
    });

    it('should handle patterns with double asterisks at start', () => {
      const files = [
        'app/page.tsx',
        'app/dashboard/page.tsx',
        'src/utils/helpers.ts',
      ];

      const patterns = ['**/page.tsx'];
      const result = fileDiscovery.filter(files, patterns);

      expect(result).toContain('app/page.tsx');
      expect(result).toContain('app/dashboard/page.tsx');
      expect(result).not.toContain('src/utils/helpers.ts');
    });

    it('should handle patterns with double asterisks at end', () => {
      const files = [
        'app/page.tsx',
        'app/dashboard/page.tsx',
        'app/dashboard/analytics/page.tsx',
      ];

      const patterns = ['app/**'];
      const result = fileDiscovery.filter(files, patterns);

      expect(result).toContain('app/page.tsx');
      expect(result).toContain('app/dashboard/page.tsx');
      expect(result).toContain('app/dashboard/analytics/page.tsx');
    });

    it('should handle patterns with double asterisks in middle', () => {
      const files = [
        'app/api/users/route.ts',
        'app/api/v1/users/route.ts',
        'app/api/v1/v2/users/route.ts',
      ];

      const patterns = ['app/api/**/route.ts'];
      const result = fileDiscovery.filter(files, patterns);

      expect(result).toContain('app/api/users/route.ts');
      expect(result).toContain('app/api/v1/users/route.ts');
      expect(result).toContain('app/api/v1/v2/users/route.ts');
    });
  });

  describe('mock file system integration', () => {
    it('should handle empty directories', async () => {
      const structure = {
        'app/.gitkeep': '',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = { rootDir };

      const result = await fileDiscovery.discover(rootDir, config);

      expect(result.routes).toEqual([]);
      expect(result.api).toEqual([]);
      expect(result.components).toEqual([]);
      expect(result.utilities).toEqual([]);
    });

    it('should handle large number of files', async () => {
      const structure: Record<string, string> = {};
      
      // Create 50 page files
      for (let i = 0; i < 50; i++) {
        structure[`app/page-${i}/page.tsx`] = `export default function Page${i}() {}`;
      }

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = { rootDir };

      const result = await fileDiscovery.discover(rootDir, config);

      expect(result.routes.length).toBe(50);
    });

    it('should handle mixed file types in same directory', async () => {
      const structure = {
        'app/page.tsx': 'export default function Home() {}',
        'app/layout.tsx': 'export default function Layout() {}',
        'app/styles.css': 'body { margin: 0; }',
        'app/data.json': '{}',
        'app/utils.ts': 'export function util() {}',
      };

      const rootDir = await createTempStructure(structure);
      const config: ProjectConfig = { rootDir };

      const result = await fileDiscovery.discover(rootDir, config);

      // Should only include TypeScript/JavaScript files
      expect(result.routes).toContain('app/page.tsx');
      expect(result.routes).toContain('app/layout.tsx');
      expect(result.routes).not.toContain('app/styles.css');
      expect(result.routes).not.toContain('app/data.json');
    });
  });
});
