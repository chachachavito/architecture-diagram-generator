import {
  ArchitectureClassifier,
  ClassificationRule,
} from '../../core/ArchitectureClassifier';
import { DependencyGraph, GraphNode } from '../../core/DependencyGraph';
import { ProjectConfig } from '../../core/FileDiscovery';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, type: GraphNode['type'] = 'utility'): GraphNode {
  return { id, type, externalCalls: [] };
}

function makeGraph(nodes: GraphNode[]): DependencyGraph {
  const graph = new DependencyGraph();
  for (const node of nodes) {
    graph.addNode(node);
  }
  return graph;
}

const defaultConfig: ProjectConfig = {
  rootDir: '/project',
  include: [],
  exclude: [],
};

// ---------------------------------------------------------------------------
// Custom Layer Assignment Tests
// ---------------------------------------------------------------------------

describe('ArchitectureClassifier - Custom Layer Assignment', () => {
  let classifier: ArchitectureClassifier;

  beforeEach(() => {
    classifier = new ArchitectureClassifier();
  });

  it('assigns custom layer to nodes matching pattern', () => {
    const nodes = [
      makeNode('/project/app/api/risk/route.ts', 'api'),
      makeNode('/project/app/api/weather/route.ts', 'api'),
    ];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, layer: 'Processing', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('Processing');
    expect(nodes[1].layer).toBeUndefined(); // No match
  });

  it('assigns custom layer to single matching node', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, layer: 'Data', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('Data');
  });

  it('assigns custom layer to multiple matching nodes', () => {
    const nodes = [
      makeNode('/project/app/api/risk/route.ts', 'api'),
      makeNode('/project/app/risk/page.tsx', 'route'),
      makeNode('/project/lib/risk-calculator.ts', 'utility'),
    ];
    const rules: ClassificationRule[] = [
      { pattern: /risk/i, layer: 'Processing', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('Processing');
    expect(nodes[1].layer).toBe('Processing');
    expect(nodes[2].layer).toBe('Processing');
  });

  it('overrides existing layer assignment with custom rule', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    nodes[0].layer = 'API';
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, layer: 'Processing', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('Processing');
  });

  it('handles custom layer assignment with complex patterns', () => {
    const nodes = [
      makeNode('/project/app/admin/risk-validator/page.tsx', 'route'),
      makeNode('/project/app/admin/performance/page.tsx', 'route'),
    ];
    const rules: ClassificationRule[] = [
      { pattern: /\/admin\/risk-validator\//i, layer: 'Processing', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('Processing');
    expect(nodes[1].layer).toBeUndefined();
  });

  it('assigns custom layer to all architecture layers', () => {
    const nodes = [
      makeNode('/project/app/api/test1/route.ts', 'api'),
      makeNode('/project/app/api/test2/route.ts', 'api'),
      makeNode('/project/app/api/test3/route.ts', 'api'),
      makeNode('/project/app/api/test4/route.ts', 'api'),
      makeNode('/project/app/api/test5/route.ts', 'api'),
    ];
    const rules: ClassificationRule[] = [
      { pattern: /test1/i, layer: 'UI', priority: 20 },
      { pattern: /test2/i, layer: 'API', priority: 20 },
      { pattern: /test3/i, layer: 'Processing', priority: 20 },
      { pattern: /test4/i, layer: 'Data', priority: 20 },
      { pattern: /test5/i, layer: 'Storage', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('UI');
    expect(nodes[1].layer).toBe('API');
    expect(nodes[2].layer).toBe('Processing');
    expect(nodes[3].layer).toBe('Data');
    expect(nodes[4].layer).toBe('Storage');
  });

  it('does not assign layer when rule has no layer property', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, domain: 'Risk', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBeUndefined();
  });

  it('handles Windows-style paths in custom layer assignment', () => {
    const nodes = [makeNode('C:\\project\\app\\api\\risk\\route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, layer: 'Processing', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('Processing');
  });

  it('handles case-insensitive pattern matching for custom layers', () => {
    const nodes = [
      makeNode('/project/app/api/RISK/route.ts', 'api'),
      makeNode('/project/app/api/Risk/route.ts', 'api'),
      makeNode('/project/app/api/risk/route.ts', 'api'),
    ];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, layer: 'Processing', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('Processing');
    expect(nodes[1].layer).toBe('Processing');
    expect(nodes[2].layer).toBe('Processing');
  });

  it('skips external-service nodes when assigning custom layers', () => {
    const nodes = [makeNode('prisma', 'external-service')];
    nodes[0].layer = 'Storage';
    const rules: ClassificationRule[] = [
      { pattern: /prisma/i, layer: 'Processing', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('Storage'); // Should not change
  });
});

// ---------------------------------------------------------------------------
// Custom Domain Assignment Tests
// ---------------------------------------------------------------------------

describe('ArchitectureClassifier - Custom Domain Assignment', () => {
  let classifier: ArchitectureClassifier;

  beforeEach(() => {
    classifier = new ArchitectureClassifier();
  });

  it('assigns custom domain to nodes matching pattern', () => {
    const nodes = [
      makeNode('/project/app/api/risk/route.ts', 'api'),
      makeNode('/project/app/api/weather/route.ts', 'api'),
    ];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, domain: 'Risk Management', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].domain).toBe('Risk Management');
    expect(nodes[1].domain).toBeUndefined(); // No match
  });

  it('assigns custom domain to single matching node', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, domain: 'Risk Management', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].domain).toBe('Risk Management');
  });

  it('assigns custom domain to multiple matching nodes', () => {
    const nodes = [
      makeNode('/project/app/api/risk/route.ts', 'api'),
      makeNode('/project/app/risk/page.tsx', 'route'),
      makeNode('/project/lib/risk-calculator.ts', 'utility'),
    ];
    const rules: ClassificationRule[] = [
      { pattern: /risk/i, domain: 'Risk Management', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].domain).toBe('Risk Management');
    expect(nodes[1].domain).toBe('Risk Management');
    expect(nodes[2].domain).toBe('Risk Management');
  });

  it('overrides existing domain assignment with custom rule', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    nodes[0].domain = 'Risk';
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, domain: 'Risk Management', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].domain).toBe('Risk Management');
  });

  it('handles custom domain assignment with complex patterns', () => {
    const nodes = [
      makeNode('/project/app/admin/risk-validator/page.tsx', 'route'),
      makeNode('/project/app/admin/performance/page.tsx', 'route'),
    ];
    const rules: ClassificationRule[] = [
      { pattern: /\/admin\/risk-validator\//i, domain: 'Risk Validation', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].domain).toBe('Risk Validation');
    expect(nodes[1].domain).toBeUndefined();
  });

  it('assigns custom domain with special characters', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, domain: 'Risk & Compliance', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].domain).toBe('Risk & Compliance');
  });

  it('assigns custom domain with spaces', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, domain: 'Risk Management System', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].domain).toBe('Risk Management System');
  });

  it('does not assign domain when rule has no domain property', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, layer: 'Processing', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].domain).toBeUndefined();
  });

  it('handles Windows-style paths in custom domain assignment', () => {
    const nodes = [makeNode('C:\\project\\app\\api\\risk\\route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, domain: 'Risk Management', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].domain).toBe('Risk Management');
  });

  it('handles case-insensitive pattern matching for custom domains', () => {
    const nodes = [
      makeNode('/project/app/api/RISK/route.ts', 'api'),
      makeNode('/project/app/api/Risk/route.ts', 'api'),
      makeNode('/project/app/api/risk/route.ts', 'api'),
    ];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, domain: 'Risk Management', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].domain).toBe('Risk Management');
    expect(nodes[1].domain).toBe('Risk Management');
    expect(nodes[2].domain).toBe('Risk Management');
  });

  it('skips external-service nodes when assigning custom domains', () => {
    const nodes = [makeNode('prisma', 'external-service')];
    const rules: ClassificationRule[] = [
      { pattern: /prisma/i, domain: 'Database', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].domain).toBeUndefined(); // Should not change
  });

  it('assigns multiple different custom domains to different nodes', () => {
    const nodes = [
      makeNode('/project/app/api/risk/route.ts', 'api'),
      makeNode('/project/app/api/weather/route.ts', 'api'),
      makeNode('/project/app/api/radar/route.ts', 'api'),
    ];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, domain: 'Risk Management', priority: 20 },
      { pattern: /\/weather\//i, domain: 'Weather Services', priority: 20 },
      { pattern: /\/radar\//i, domain: 'Radar Monitoring', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].domain).toBe('Risk Management');
    expect(nodes[1].domain).toBe('Weather Services');
    expect(nodes[2].domain).toBe('Radar Monitoring');
  });
});

// ---------------------------------------------------------------------------
// Rule Priority Resolution Tests
// ---------------------------------------------------------------------------

describe('ArchitectureClassifier - Rule Priority Resolution', () => {
  let classifier: ArchitectureClassifier;

  beforeEach(() => {
    classifier = new ArchitectureClassifier();
  });

  it('resolves layer conflict by priority (higher priority wins)', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/api\//i, layer: 'API', priority: 10 },
      { pattern: /\/risk\//i, layer: 'Processing', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('Processing'); // Priority 20 wins
  });

  it('resolves domain conflict by priority (higher priority wins)', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/api\//i, domain: 'API Services', priority: 10 },
      { pattern: /\/risk\//i, domain: 'Risk Management', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].domain).toBe('Risk Management'); // Priority 20 wins
  });

  it('resolves three-way layer conflict by priority', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/app\//i, layer: 'UI', priority: 5 },
      { pattern: /\/api\//i, layer: 'API', priority: 10 },
      { pattern: /\/risk\//i, layer: 'Processing', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('Processing'); // Highest priority (20) wins
  });

  it('resolves three-way domain conflict by priority', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/app\//i, domain: 'App', priority: 5 },
      { pattern: /\/api\//i, domain: 'API', priority: 10 },
      { pattern: /\/risk\//i, domain: 'Risk', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].domain).toBe('Risk'); // Highest priority (20) wins
  });

  it('applies layer and domain from different rules independently', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/api\//i, layer: 'API', priority: 15 },
      { pattern: /\/risk\//i, domain: 'Risk Management', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('API');
    expect(nodes[0].domain).toBe('Risk Management');
  });

  it('resolves layer and domain conflicts independently', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/api\//i, layer: 'API', priority: 10, domain: 'API Services', priority: 10 },
      { pattern: /\/risk\//i, layer: 'Processing', priority: 20, domain: 'Risk Management', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    // Both should use the highest priority rule
    expect(nodes[0].layer).toBe('Processing');
    expect(nodes[0].domain).toBe('Risk Management');
  });

  it('handles equal priority rules (first match wins)', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/api\//i, layer: 'API', priority: 20 },
      { pattern: /\/risk\//i, layer: 'Processing', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    // When priorities are equal, the first matching rule should win
    // (implementation iterates through rules in order)
    expect(nodes[0].layer).toBe('API');
  });

  it('resolves priority for multiple nodes with different conflicts', () => {
    const nodes = [
      makeNode('/project/app/api/risk/route.ts', 'api'),
      makeNode('/project/app/api/weather/route.ts', 'api'),
    ];
    const rules: ClassificationRule[] = [
      { pattern: /\/api\//i, layer: 'API', priority: 10 },
      { pattern: /\/risk\//i, layer: 'Processing', priority: 20 },
      { pattern: /\/weather\//i, layer: 'Data', priority: 15 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('Processing'); // Priority 20 wins
    expect(nodes[1].layer).toBe('Data'); // Priority 15 wins over 10
  });

  it('handles priority 0 (lowest priority)', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, layer: 'Processing', priority: 0 },
      { pattern: /\/api\//i, layer: 'API', priority: 1 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('API'); // Priority 1 wins
  });

  it('handles very high priority values', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/api\//i, layer: 'API', priority: 100 },
      { pattern: /\/risk\//i, layer: 'Processing', priority: 1000 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('Processing'); // Priority 1000 wins
  });

  it('resolves priority when only one rule matches', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/weather\//i, layer: 'Data', priority: 100 },
      { pattern: /\/risk\//i, layer: 'Processing', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('Processing'); // Only matching rule
  });

  it('resolves priority when no rules match', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    nodes[0].layer = 'API';
    const rules: ClassificationRule[] = [
      { pattern: /\/weather\//i, layer: 'Data', priority: 100 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('API'); // Unchanged
  });

  it('resolves priority for both layer and domain in same rule', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/api\//i, layer: 'API', domain: 'API Services', priority: 10 },
      { pattern: /\/risk\//i, layer: 'Processing', domain: 'Risk Management', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    // Both layer and domain should use the highest priority rule
    expect(nodes[0].layer).toBe('Processing');
    expect(nodes[0].domain).toBe('Risk Management');
  });

  it('resolves priority when layer and domain come from different rules', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/api\//i, layer: 'API', priority: 20 },
      { pattern: /\/risk\//i, domain: 'Risk Management', priority: 15 },
    ];

    classifier.applyCustomRules(nodes, rules);

    // Layer from highest priority layer rule, domain from highest priority domain rule
    expect(nodes[0].layer).toBe('API');
    expect(nodes[0].domain).toBe('Risk Management');
  });
});

// ---------------------------------------------------------------------------
// Edge Cases and Integration Tests
// ---------------------------------------------------------------------------

describe('ArchitectureClassifier - Custom Rules Edge Cases', () => {
  let classifier: ArchitectureClassifier;

  beforeEach(() => {
    classifier = new ArchitectureClassifier();
  });

  it('handles empty rules array', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    nodes[0].layer = 'API';
    nodes[0].domain = 'Risk';

    classifier.applyCustomRules(nodes, []);

    expect(nodes[0].layer).toBe('API');
    expect(nodes[0].domain).toBe('Risk');
  });

  it('handles empty nodes array', () => {
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, layer: 'Processing', priority: 20 },
    ];

    // Should not throw
    classifier.applyCustomRules([], rules);
  });

  it('handles both empty nodes and rules', () => {
    // Should not throw
    classifier.applyCustomRules([], []);
  });

  it('handles rule with neither layer nor domain', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBeUndefined();
    expect(nodes[0].domain).toBeUndefined();
  });

  it('handles rule with only layer property', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, layer: 'Processing', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('Processing');
    expect(nodes[0].domain).toBeUndefined();
  });

  it('handles rule with only domain property', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, domain: 'Risk Management', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBeUndefined();
    expect(nodes[0].domain).toBe('Risk Management');
  });

  it('handles very long file paths', () => {
    const longPath = '/project/app/api/very/deeply/nested/path/with/many/segments/risk/route.ts';
    const nodes = [makeNode(longPath, 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, layer: 'Processing', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('Processing');
  });

  it('handles special regex characters in pattern', () => {
    const nodes = [makeNode('/project/app/api/risk-validator/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /risk-validator/i, layer: 'Processing', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('Processing');
  });

  it('handles multiple rules matching same node with different properties', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/api\//i, layer: 'API', priority: 10 },
      { pattern: /\/risk\//i, domain: 'Risk Management', priority: 15 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('API');
    expect(nodes[0].domain).toBe('Risk Management');
  });

  it('applies rules to all node types', () => {
    const nodes = [
      makeNode('/project/app/api/risk/route.ts', 'api'),
      makeNode('/project/app/risk/page.tsx', 'route'),
      makeNode('/project/components/risk/Panel.tsx', 'component'),
      makeNode('/project/lib/risk-calculator.ts', 'utility'),
      makeNode('/project/config/risk.json', 'config'),
    ];
    const rules: ClassificationRule[] = [
      { pattern: /risk/i, layer: 'Processing', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    for (const node of nodes) {
      expect(node.layer).toBe('Processing');
    }
  });

  it('preserves other node properties when applying rules', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    nodes[0].label = 'Risk API';
    nodes[0].externalCalls = [{ type: 'fetch', target: 'https://api.example.com', location: { line: 10 } }];
    
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, layer: 'Processing', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].label).toBe('Risk API');
    expect(nodes[0].externalCalls).toHaveLength(1);
    expect(nodes[0].layer).toBe('Processing');
  });

  it('handles nodes with undefined initial layer and domain', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    expect(nodes[0].layer).toBeUndefined();
    expect(nodes[0].domain).toBeUndefined();

    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, layer: 'Processing', domain: 'Risk', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('Processing');
    expect(nodes[0].domain).toBe('Risk');
  });

  it('handles partial matches (pattern matches substring)', () => {
    const nodes = [
      makeNode('/project/app/api/risk-validator/route.ts', 'api'),
      makeNode('/project/app/api/risk/route.ts', 'api'),
    ];
    const rules: ClassificationRule[] = [
      { pattern: /risk/i, layer: 'Processing', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    // Both should match because pattern matches substring
    expect(nodes[0].layer).toBe('Processing');
    expect(nodes[1].layer).toBe('Processing');
  });

  it('handles exact matches vs partial matches', () => {
    const nodes = [
      makeNode('/project/app/api/risk/route.ts', 'api'),
      makeNode('/project/app/api/risk-validator/route.ts', 'api'),
    ];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//, layer: 'Processing', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('Processing');
    expect(nodes[1].layer).toBeUndefined(); // Doesn't match exact pattern
  });
});
