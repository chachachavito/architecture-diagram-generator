import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync, rmdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

describe('CLI - Multi-format Output Integration', () => {
  const testProjectDir = join(process.cwd(), '.test-cli-project');
  const testOutputDir = join(testProjectDir, 'output');

  beforeEach(() => {
    // Create test project directory
    if (!existsSync(testProjectDir)) {
      require('fs').mkdirSync(testProjectDir, { recursive: true });
    }

    // Create sample files
    const sampleFiles = {
      'app/page.tsx': `export default function Home() { return <div>Home</div>; }`,
      'app/api/test/route.ts': `export async function GET() { return Response.json({}); }`,
      'lib/utils.ts': `export function helper() { return 'test'; }`,
    };

    for (const [filePath, content] of Object.entries(sampleFiles)) {
      const fullPath = join(testProjectDir, filePath);
      const dir = require('path').dirname(fullPath);
      if (!existsSync(dir)) {
        require('fs').mkdirSync(dir, { recursive: true });
      }
      require('fs').writeFileSync(fullPath, content);
    }

    // Create package.json
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      type: 'module',
    };
    require('fs').writeFileSync(
      join(testProjectDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create tsconfig.json
    const tsconfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'esnext',
        lib: ['ES2020', 'dom'],
      },
    };
    require('fs').writeFileSync(
      join(testProjectDir, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2)
    );
  });

  afterEach(() => {
    // Clean up test project
    try {
      const removeDir = (dir: string) => {
        if (existsSync(dir)) {
          const files = readdirSync(dir);
          for (const file of files) {
            const filePath = join(dir, file);
            const stat = require('fs').statSync(filePath);
            if (stat.isDirectory()) {
              removeDir(filePath);
            } else {
              unlinkSync(filePath);
            }
          }
          rmdirSync(dir);
        }
      };
      removeDir(testProjectDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should generate markdown output by default', () => {
    const outputPath = join(testProjectDir, 'architecture.json');
    const mdPath = join(testProjectDir, 'architecture.md');
    
    try {
      execSync(`node dist/cli.js ${testProjectDir}`, {
        stdio: 'pipe',
        cwd: process.cwd(),
      });

      expect(existsSync(outputPath)).toBe(true);
      expect(existsSync(mdPath)).toBe(true);
      const content = require('fs').readFileSync(mdPath, 'utf-8');
      expect(content).toContain('flowchart TD');
      expect(content).toContain('```mermaid');
    } catch (error) {
      console.error(error);
      throw error;
    }
  });

  it('should support custom output path via --output flag', () => {
    const customJson = join(testProjectDir, 'custom.json');
    const customMd = join(testProjectDir, 'custom.md');
    
    try {
      execSync(`node dist/cli.js ${testProjectDir} --output ${customJson}`, {
        stdio: 'pipe',
        cwd: process.cwd(),
      });

      expect(existsSync(customJson)).toBe(true);
      expect(existsSync(customMd)).toBe(true);
    } catch (error) {
      console.error(error);
      throw error;
    }
  });
});
