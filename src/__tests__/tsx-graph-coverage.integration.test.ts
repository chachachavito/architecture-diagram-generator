import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ArchitecturePipeline } from '../core/ArchitecturePipeline';

/**
 * End-to-end guard for the resolution bug that made React projects look clean.
 *
 * Imports of .tsx files resolved to a '.ts' path that did not exist, so their
 * edges never entered the graph. A component tree produced almost no edges,
 * layer-violation had nothing to compare, and the report said 100/100. Unit
 * coverage of the resolver is not enough — the value is in the graph.
 */
describe('graph coverage for .tsx projects', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'tsx-coverage-'));

    const files: Record<string, string> = {
      'components/Button.tsx': `export default function Button() { return null; }\n`,
      'components/Card.tsx': `import Button from './Button';\nexport default function Card() { return Button; }\n`,
      'components/Table.tsx': `import Card from './Card';\nimport { fmt } from '../lib/fmt';\nexport default function Table() { return [Card, fmt]; }\n`,
      'lib/fmt.ts': `export function fmt(s: string) { return s; }\n`,
      'app/dashboard/page.tsx': `import Table from '../../components/Table';\nexport default function Page() { return Table; }\n`,
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

  it('captures every dependency between .tsx modules', async () => {
    const pipeline = new ArchitecturePipeline({
      version: 'test',
      config: {},
      rootDir: root,
      analyzerConfig: { rules: {}, history: { enabled: false, maxEntries: 0, directory: '.x' } },
    });

    const { graph } = await pipeline.runFull(root);
    const edges = graph.edges.map((e) => `${e.from}->${e.to}`);

    // Every import in the fixture; all but one target a .tsx file.
    expect(edges).toContain('components/Card.tsx->components/Button.tsx');
    expect(edges).toContain('components/Table.tsx->components/Card.tsx');
    expect(edges).toContain('components/Table.tsx->lib/fmt.ts');
    expect(edges).toContain('app/dashboard/page.tsx->components/Table.tsx');
    expect(edges).toHaveLength(4);
  });

  it('detects a Core → UI violation that depends on a .tsx edge existing', async () => {
    // lib/ is Core, components/ is UI: depending outward is a violation, and it
    // is only visible if the .tsx import resolves.
    await fs.writeFile(
      path.join(root, 'lib/fmt.ts'),
      `import Button from '../components/Button';\nexport function fmt(s: string) { return [s, Button]; }\n`,
    );

    const pipeline = new ArchitecturePipeline({
      version: 'test',
      config: {},
      rootDir: root,
      analyzerConfig: {
        rules: { 'layer-violation': { enabled: true, severity: 'high' } },
        history: { enabled: false, maxEntries: 0, directory: '.x' },
      },
    });

    const { analysis } = await pipeline.runFull(root);

    expect(analysis?.summary.layerViolations).toBeGreaterThan(0);
  });
});
