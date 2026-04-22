import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('CLI - Multi-format Output Integration', () => {
  const testProjectDir = path.join(process.cwd(), '.test-cli-project');

  beforeEach(() => {
    // Create test project directory
    if (!fs.existsSync(testProjectDir)) {
      fs.mkdirSync(testProjectDir, { recursive: true });
    }

    // Create sample files
    const sampleFiles = {
      'app/page.tsx': `export default function Home() { return <div>Home</div>; }`,
      'app/api/test/route.ts': `export async function GET() { return Response.json({}); }`,
      'lib/utils.ts': `export function helper() { return 'test'; }`,
    };

    for (const [filePath, content] of Object.entries(sampleFiles)) {
      const fullPath = path.join(testProjectDir, filePath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fullPath, content);
    }

    // Create package.json
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      type: 'module',
    };
    fs.writeFileSync(
      path.join(testProjectDir, 'package.json'),
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
    fs.writeFileSync(
      path.join(testProjectDir, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2)
    );
  });

  afterEach(() => {
    // Clean up test project
    try {
      const removeDir = (dir: string) => {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
              removeDir(filePath);
            } else {
              fs.unlinkSync(filePath);
            }
          }
          fs.rmdirSync(dir);
        }
      };
      removeDir(testProjectDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should generate markdown output by default', () => {
    const outputPath = path.join(testProjectDir, 'architecture.json');
    const mdPath = path.join(testProjectDir, 'architecture.md');
    
    try {
      execSync(`node dist/cli.js ${testProjectDir}`, {
        stdio: 'pipe',
        cwd: process.cwd(),
      });

      expect(fs.existsSync(outputPath)).toBe(true);
      expect(fs.existsSync(mdPath)).toBe(true);
      const content = fs.readFileSync(mdPath, 'utf-8');
      expect(content).toContain('flowchart TD');
      expect(content).toContain('```mermaid');
    } catch (error) {
      console.error(error);
      throw error;
    }
  });

  it('should support custom output path via --output flag', () => {
    const customJson = path.join(testProjectDir, 'custom.json');
    const customMd = path.join(testProjectDir, 'custom.md');
    
    try {
      execSync(`node dist/cli.js ${testProjectDir} --output ${customJson}`, {
        stdio: 'pipe',
        cwd: process.cwd(),
      });

      expect(fs.existsSync(customJson)).toBe(true);
      expect(fs.existsSync(customMd)).toBe(true);
    } catch (error) {
      console.error(error);
      throw error;
    }
  });
});
