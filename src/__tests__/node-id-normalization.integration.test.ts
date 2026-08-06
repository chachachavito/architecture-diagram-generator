import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ArchitecturePipeline } from '../core/ArchitecturePipeline';

/**
 * Node ids must be relative to the analysed project, whatever the working
 * directory happens to be.
 *
 * DependencyGraphBuilder defaulted its root to process.cwd() while the
 * Normalizer strips the configured rootDir, so running the pipeline against a
 * project other than the current directory left the difference on the front of
 * every id. Invisible through the CLI, where the two coincide; anything
 * matching on ids — layer patterns, includes, baselines — broke for
 * programmatic callers.
 */
describe('node id normalization', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'node-ids-'));

    const files: Record<string, string> = {
      'lib/session.ts': `export function verify() { return true; }\n`,
      'app/dashboard/page.tsx': `import { verify } from '../../lib/session';\nexport default function Page() { return verify; }\n`,
    };

    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(root, rel);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, content);
    }
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('produces project-relative ids when cwd is not the project root', async () => {
    // The test process runs from the repo, never from `root`.
    expect(process.cwd()).not.toBe(root);

    const pipeline = new ArchitecturePipeline({
      version: 'test',
      config: {},
      rootDir: root,
      analyzerConfig: { rules: {}, history: { enabled: false, maxEntries: 0, directory: '.x' } },
    });

    const { graph } = await pipeline.runFull(root);
    const ids = graph.nodes.map((n) => n.id).filter((id) => !id.startsWith('.'));

    expect(ids).toContain('lib/session.ts');
    expect(ids).toContain('app/dashboard/page.tsx');
  });

  it('keeps edge endpoints on the same project-relative ids', async () => {
    const pipeline = new ArchitecturePipeline({
      version: 'test',
      config: {},
      rootDir: root,
      analyzerConfig: { rules: {}, history: { enabled: false, maxEntries: 0, directory: '.x' } },
    });

    const { graph } = await pipeline.runFull(root);
    const edges = graph.edges.map((e) => `${e.from}->${e.to}`);

    expect(edges).toContain('app/dashboard/page.tsx->lib/session.ts');
  });
});
