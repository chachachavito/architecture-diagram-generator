import { describe, it, expect } from 'vitest';
import { ArchitectureFilter } from './ArchitectureFilter';
import { DependencyGraph, GraphNode, GraphEdge } from './DependencyGraph';

function node(id: string, layer: GraphNode['layer'], label?: string): GraphNode {
  return {
    id,
    layer,
    label,
    type: 'module',
    metadata: { type: 'module', source: 'inferred' },
  };
}

function edge(from: string, to: string): GraphEdge {
  return { id: `${from}->${to}:import`, from, to, type: 'import' };
}

function graphOf(nodes: GraphNode[], edges: GraphEdge[] = []): DependencyGraph {
  const g = new DependencyGraph();
  for (const n of nodes) g.addNode(n);
  for (const e of edges) g.addEdge(e);
  return g;
}

describe('ArchitectureFilter', () => {
  /**
   * The filter previously shipped hardcoded domain vocabulary from one
   * specific application (weather/hydrology terms), so any project with a file
   * named e.g. forecast.ts received an invented domain. Defaults must stay
   * empty: guard against that vocabulary creeping back in.
   */
  describe('domain inference defaults', () => {
    it('assigns no domain when none is configured', () => {
      const graph = graphOf([
        node('app/api/forecast/route.ts', 'API'),
        node('app/radar/page.tsx', 'UI'),
        node('lib/tide.ts', 'Core'),
      ]);

      const { graph: result } = new ArchitectureFilter().filter(graph);

      for (const n of result.nodes.values()) {
        expect(n.domain).toBeUndefined();
      }
    });

    it('assigns domains only from configured vocabulary', () => {
      const graph = graphOf([
        node('app/api/billing/route.ts', 'API'),
        node('app/api/forecast/route.ts', 'API'),
      ]);

      const filter = new ArchitectureFilter({
        domainMaps: { API: [{ patterns: ['billing'], domain: 'Payments' }] },
      });
      const { graph: result } = filter.filter(graph);

      const domains = [...result.nodes.values()].map((n) => n.domain);
      expect(domains).toContain('Payments');
      expect(domains).toContain(undefined);
    });

    it('matches configured patterns case-insensitively', () => {
      const graph = graphOf([node('lib/RiskEngine.ts', 'Core')]);

      const filter = new ArchitectureFilter({
        domainMaps: { Core: [{ patterns: ['RiskEngine'], domain: 'Risk' }] },
      });
      const { graph: result } = filter.filter(graph);

      expect([...result.nodes.values()][0].domain).toBe('Risk');
    });
  });

  describe('renames', () => {
    it('applies no renames by default', () => {
      const graph = graphOf([node('lib/weatherService.ts', 'Core')]);

      const { graph: result, coreNodes } = new ArchitectureFilter().filter(graph);

      expect(coreNodes.size).toBe(0);
      expect([...result.nodes.keys()]).not.toContain('WeatherCore');
    });

    it('applies configured renames to matching nodes', () => {
      const graph = graphOf([node('lib/billingEngine.ts', 'Core')]);

      const filter = new ArchitectureFilter({
        renames: [{ pattern: /billingEngine/i, id: 'BillingCore', label: 'Billing Core' }],
      });
      const { graph: result, coreNodes } = filter.filter(graph);

      expect(coreNodes.has('BillingCore')).toBe(true);
      expect(result.nodes.get('BillingCore')?.label).toBe('Billing Core');
    });
  });

  describe('structural exclusions', () => {
    it('drops utility and type modules by default', () => {
      const graph = graphOf([
        node('app/dashboard/page.tsx', 'UI'),
        node('src/utils/format.ts', 'Core'),
        node('src/types/models.ts', 'Core'),
        node('src/hooks/useThing.ts', 'Core'),
      ]);

      const { graph: result } = new ArchitectureFilter().filter(graph);
      const ids = [...result.nodes.values()].map((n) => n.id);

      expect(ids).toHaveLength(1);
      expect(ids[0]).not.toContain('utils');
    });

    it('honours overridden exclusion patterns', () => {
      const graph = graphOf([
        node('app/dashboard/page.tsx', 'UI'),
        node('src/utils/format.ts', 'Core'),
      ]);

      const { graph: result } = new ArchitectureFilter({ excludePathPatterns: [] }).filter(graph);

      expect(result.nodes.size).toBe(2);
    });
  });

  describe('size limiting', () => {
    it('respects a configured node budget', () => {
      const nodes = Array.from({ length: 12 }, (_, i) =>
        node(`app/section${i}/page.tsx`, 'UI'),
      );

      const { graph: result } = new ArchitectureFilter({ maxNodes: 5 }).filter(graphOf(nodes));

      expect(result.nodes.size).toBeLessThanOrEqual(5);
    });
  });

  describe('edges', () => {
    it('keeps top-down edges between retained nodes', () => {
      const graph = graphOf(
        [node('app/dashboard/page.tsx', 'UI'), node('lib/session.ts', 'Core')],
        [edge('app/dashboard/page.tsx', 'lib/session.ts')],
      );

      const { graph: result } = new ArchitectureFilter().filter(graph);

      expect(result.edges).toHaveLength(1);
    });
  });
});
