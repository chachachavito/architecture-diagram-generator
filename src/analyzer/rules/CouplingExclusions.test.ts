import { describe, it, expect } from 'vitest';
import { FanOutRule } from './FanOutRule';
import { FanInRule } from './FanInRule';
import { ClassifiedGraph, GraphNode, GraphEdge } from '../../core/GraphTypes';
import { RuleConfig } from '../types';

/**
 * Barrels and shared type modules are *supposed* to touch many modules: a
 * barrel's fan-out is the surface it re-exports, and a type module's fan-in
 * disappears at compile time. Counting them as coupling produced issues whose
 * only available fix — splitting the barrel — makes the codebase worse.
 */

function node(id: string, extra: Record<string, unknown> = {}): GraphNode {
  return {
    id,
    metadata: { type: 'module', source: 'inferred', ...extra },
  } as GraphNode;
}

function edgesFrom(from: string, count: number): GraphEdge[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${from}->dep${i}:import`,
    from,
    to: `dep${i}.ts`,
    type: 'import' as const,
  }));
}

function edgesTo(to: string, count: number): GraphEdge[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `src${i}->${to}:import`,
    from: `src${i}.ts`,
    to,
    type: 'import' as const,
  }));
}

function graph(nodes: GraphNode[], edges: GraphEdge[]): ClassifiedGraph {
  return { nodes, edges, version: 'test' } as ClassifiedGraph;
}

const enabled: RuleConfig = { enabled: true, severity: 'medium' };

describe('FanOutRule — barrel exclusion', () => {
  it('does not flag a barrel that re-exports many modules', () => {
    const g = graph([node('src/index.ts', { isBarrel: true })], edgesFrom('src/index.ts', 20));

    const issues = new FanOutRule().run(g, enabled);

    expect(issues).toHaveLength(0);
  });

  it('still flags an ordinary module with the same fan-out', () => {
    const g = graph([node('src/god.ts')], edgesFrom('src/god.ts', 20));

    const issues = new FanOutRule().run(g, enabled);

    expect(issues).toHaveLength(1);
    expect(issues[0].nodeId).toBe('src/god.ts');
  });

  it('flags barrels when includeBarrels is enabled', () => {
    const g = graph([node('src/index.ts', { isBarrel: true })], edgesFrom('src/index.ts', 20));

    const issues = new FanOutRule().run(g, { ...enabled, includeBarrels: true });

    expect(issues).toHaveLength(1);
  });
});

describe('FanInRule — type module and barrel exclusion', () => {
  it('does not flag a module whose exports are all types', () => {
    const g = graph(
      [node('src/types.ts', { isTypeOnlyModule: true })],
      edgesTo('src/types.ts', 30),
    );

    const issues = new FanInRule().run(g, enabled);

    expect(issues).toHaveLength(0);
  });

  it('still flags a runtime module with the same fan-in', () => {
    const g = graph([node('src/hub.ts')], edgesTo('src/hub.ts', 30));

    const issues = new FanInRule().run(g, enabled);

    expect(issues).toHaveLength(1);
    expect(issues[0].nodeId).toBe('src/hub.ts');
  });

  it('flags type modules when includeTypeModules is enabled', () => {
    const g = graph(
      [node('src/types.ts', { isTypeOnlyModule: true })],
      edgesTo('src/types.ts', 30),
    );

    const issues = new FanInRule().run(g, { ...enabled, includeTypeModules: true });

    expect(issues).toHaveLength(1);
  });

  it('does not flag a barrel on the receiving end either', () => {
    const g = graph([node('src/index.ts', { isBarrel: true })], edgesTo('src/index.ts', 30));

    const issues = new FanInRule().run(g, enabled);

    expect(issues).toHaveLength(0);
  });

  it('keeps flagging a mixed module that exports runtime values too', () => {
    // isTypeOnlyModule is false when any export is a value — such a module is
    // genuine runtime coupling and must stay visible.
    const g = graph([node('src/mixed.ts', { isTypeOnlyModule: false })], edgesTo('src/mixed.ts', 30));

    const issues = new FanInRule().run(g, enabled);

    expect(issues).toHaveLength(1);
  });
});
