import { describe, it, expect } from 'vitest';
import { LayerViolationRule } from './LayerViolationRule';
import { DEFAULT_CONFIG } from '../../core/ConfigurationLoader';
import { ClassifiedGraph, GraphNode } from '../../core/GraphTypes';
import { ARCHITECTURE_LAYERS } from '../../core/layers';

/**
 * LayerViolationRule skips any edge whose endpoint carries a layer name outside
 * ARCHITECTURE_LAYERS. That makes an unrecognised layer name in configuration
 * a silent exemption from the check rather than an error — the exact failure
 * mode this tool exists to catch. DEFAULT_CONFIG once shipped 'Processing',
 * which is not a real layer, so every module under lib/, utils/ and services/
 * would have been exempt once config started reaching the classifier.
 */
describe('layer naming', () => {
  it('DEFAULT_CONFIG only declares layers the analyzer understands', () => {
    const declared = DEFAULT_CONFIG.layers.map((l) => l.name);

    for (const name of declared) {
      expect(ARCHITECTURE_LAYERS).toContain(name);
    }
  });

  it('detects a Core → UI violation with default layer names', () => {
    const node = (id: string, layer: string): GraphNode =>
      ({ id, metadata: { type: 'module', source: 'inferred', layer } }) as GraphNode;

    // lib/ maps to Core under DEFAULT_CONFIG; a Core module reaching back into
    // UI is the canonical violation.
    const graph = {
      version: 'test',
      nodes: [node('lib/auth.ts', 'Core'), node('app/dashboard/page.tsx', 'UI')],
      edges: [
        {
          id: 'lib/auth.ts->app/dashboard/page.tsx:import',
          from: 'lib/auth.ts',
          to: 'app/dashboard/page.tsx',
          type: 'import' as const,
        },
      ],
    } as ClassifiedGraph;

    const issues = new LayerViolationRule().run(graph, { enabled: true, severity: 'high' });

    expect(issues).toHaveLength(1);
    expect(issues[0].nodeId).toBe('lib/auth.ts');
  });

  it('silently skips edges labelled with an unknown layer name', () => {
    const node = (id: string, layer: string): GraphNode =>
      ({ id, metadata: { type: 'module', source: 'inferred', layer } }) as GraphNode;

    const graph = {
      version: 'test',
      nodes: [node('lib/auth.ts', 'Processing'), node('app/dashboard/page.tsx', 'UI')],
      edges: [
        {
          id: 'lib/auth.ts->app/dashboard/page.tsx:import',
          from: 'lib/auth.ts',
          to: 'app/dashboard/page.tsx',
          type: 'import' as const,
        },
      ],
    } as ClassifiedGraph;

    const issues = new LayerViolationRule().run(graph, { enabled: true, severity: 'high' });

    // Documents the behaviour that makes the test above matter: the same
    // violation disappears when the layer is named something the rule does not
    // know. The pipeline warns when configuration does this.
    expect(issues).toHaveLength(0);
  });
});
