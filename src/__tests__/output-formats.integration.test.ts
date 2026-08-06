import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ArchitecturePipeline } from '../core/ArchitecturePipeline';
import { DEFAULT_CONFIG } from '../core/ConfigurationLoader';

/**
 * `output.formats` was parsed, validated and then read by nothing — the
 * pipeline always wrote all four artifacts. It now selects which companion
 * files are produced, with a default equal to the previous behaviour so that
 * merely having a config file cannot stop artifacts being generated.
 */
describe('output.formats', () => {
  let root: string;

  const analyzerConfig = {
    rules: {},
    history: { enabled: false, maxEntries: 0, directory: '.x' },
  };

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'output-formats-'));
    await fs.mkdir(path.join(root, 'lib'), { recursive: true });
    await fs.writeFile(path.join(root, 'lib/a.ts'), `export const a = 1;\n`);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const written = async () => {
    const entries = await fs.readdir(root);
    return entries.filter((e) => e.startsWith('arch.'));
  };

  it('writes every artifact by default', async () => {
    await new ArchitecturePipeline({
      version: 'test',
      config: {},
      rootDir: root,
      outputBase: 'arch.json',
      analyzerConfig,
    }).runFull(root);

    const files = await written();
    expect(files.sort()).toEqual(['arch.html', 'arch.json', 'arch.md', 'arch.svg']);
  });

  it('writes only the requested companions', async () => {
    await new ArchitecturePipeline({
      version: 'test',
      config: {},
      projectConfig: { ...DEFAULT_CONFIG, output: { formats: ['markdown'] } },
      rootDir: root,
      outputBase: 'arch.json',
      analyzerConfig,
    }).runFull(root);

    const files = await written();
    expect(files.sort()).toEqual(['arch.json', 'arch.md']);
  });

  it('always writes the JSON graph, even with no formats selected', async () => {
    await new ArchitecturePipeline({
      version: 'test',
      config: {},
      projectConfig: { ...DEFAULT_CONFIG, output: { formats: [] } },
      rootDir: root,
      outputBase: 'arch.json',
      analyzerConfig,
    }).runFull(root);

    // The JSON is the -o target itself, not an opt-in companion.
    expect(await written()).toEqual(['arch.json']);
  });

  it('keeps writing everything when a config file omits output', async () => {
    const withoutOutput = { ...DEFAULT_CONFIG };
    delete (withoutOutput as Partial<typeof DEFAULT_CONFIG>).output;

    await new ArchitecturePipeline({
      version: 'test',
      config: {},
      projectConfig: withoutOutput as typeof DEFAULT_CONFIG,
      rootDir: root,
      outputBase: 'arch.json',
      analyzerConfig,
    }).runFull(root);

    const files = await written();
    expect(files.sort()).toEqual(['arch.html', 'arch.json', 'arch.md', 'arch.svg']);
  });
});
