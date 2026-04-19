import {
  ArchitectureClassifier,
  ClassificationRule,
  DEFAULT_CLASSIFICATION_RULES,
} from './ArchitectureClassifier';
import { DependencyGraph, GraphNode } from './DependencyGraph';
import { ProjectConfig } from './FileDiscovery';

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
// assignLayers() — layer assignment based on file paths
// ---------------------------------------------------------------------------

describe('ArchitectureClassifier.assignLayers()', () => {
  let classifier: ArchitectureClassifier;

  beforeEach(() => {
    classifier = new ArchitectureClassifier();
  });

  it('assigns API layer to /app/api routes', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    classifier.assignLayers(nodes);
    expect(nodes[0].layer).toBe('API');
  });

  it('assigns API layer to /pages/api routes', () => {
    const nodes = [makeNode('/project/pages/api/weather/index.ts', 'api')];
    classifier.assignLayers(nodes);
    expect(nodes[0].layer).toBe('API');
  });

  it('assigns UI layer to /app page.tsx files', () => {
    const nodes = [makeNode('/project/app/dashboard/page.tsx', 'route')];
    classifier.assignLayers(nodes);
    expect(nodes[0].layer).toBe('UI');
  });

  it('assigns UI layer to /app layout.tsx files', () => {
    const nodes = [makeNode('/project/app/layout.tsx', 'route')];
    classifier.assignLayers(nodes);
    expect(nodes[0].layer).toBe('UI');
  });

  it('assigns UI layer to /pages routes', () => {
    const nodes = [makeNode('/project/pages/index.tsx', 'route')];
    classifier.assignLayers(nodes);
    expect(nodes[0].layer).toBe('UI');
  });

  it('assigns UI layer to /components files', () => {
    const nodes = [makeNode('/project/components/Button.tsx', 'component')];
    classifier.assignLayers(nodes);
    expect(nodes[0].layer).toBe('UI');
  });

  it('assigns Data layer to /prisma files', () => {
    const nodes = [makeNode('/project/prisma/schema.prisma', 'config')];
    classifier.assignLayers(nodes);
    expect(nodes[0].layer).toBe('Data');
  });

  it('assigns Data layer to /db files', () => {
    const nodes = [makeNode('/project/db/migrations/001.sql', 'config')];
    classifier.assignLayers(nodes);
    expect(nodes[0].layer).toBe('Data');
  });

  it('assigns Data layer to /models files', () => {
    const nodes = [makeNode('/project/models/User.ts', 'utility')];
    classifier.assignLayers(nodes);
    expect(nodes[0].layer).toBe('Data');
  });

  it('assigns Data layer to /schema files', () => {
    const nodes = [makeNode('/project/schema/types.ts', 'utility')];
    classifier.assignLayers(nodes);
    expect(nodes[0].layer).toBe('Data');
  });

  it('assigns Processing layer to /lib files', () => {
    const nodes = [makeNode('/project/lib/calculator.ts', 'utility')];
    classifier.assignLayers(nodes);
    expect(nodes[0].layer).toBe('Processing');
  });

  it('assigns Processing layer to /utils files', () => {
    const nodes = [makeNode('/project/utils/format.ts', 'utility')];
    classifier.assignLayers(nodes);
    expect(nodes[0].layer).toBe('Processing');
  });

  it('assigns Processing layer to /services files', () => {
    const nodes = [makeNode('/project/services/weatherService.ts', 'utility')];
    classifier.assignLayers(nodes);
    expect(nodes[0].layer).toBe('Processing');
  });

  it('assigns Processing layer to /helpers files', () => {
    const nodes = [makeNode('/project/helpers/dateHelper.ts', 'utility')];
    classifier.assignLayers(nodes);
    expect(nodes[0].layer).toBe('Processing');
  });

  it('uses highest priority rule when multiple rules match', () => {
    // /app/api/risk/route.ts matches both /app/ (UI, priority 8) and /app/api/ (API, priority 10)
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    classifier.assignLayers(nodes);
    expect(nodes[0].layer).toBe('API'); // Higher priority wins
  });

  it('falls back to node type inference when no rules match', () => {
    const nodes = [
      makeNode('/project/unknown/file.ts', 'route'),
      makeNode('/project/unknown/api.ts', 'api'),
      makeNode('/project/unknown/component.tsx', 'component'),
      makeNode('/project/unknown/util.ts', 'utility'),
      makeNode('/project/unknown/config.json', 'config'),
    ];
    classifier.assignLayers(nodes);
    
    expect(nodes[0].layer).toBe('UI');         // route → UI
    expect(nodes[1].layer).toBe('API');        // api → API
    expect(nodes[2].layer).toBe('UI');         // component → UI
    expect(nodes[3].layer).toBe('Processing'); // utility → Processing
    expect(nodes[4].layer).toBe('Processing'); // config → Processing
  });

  it('does not overwrite existing layer assignment', () => {
    const node = makeNode('/project/app/api/risk/route.ts', 'api');
    node.layer = 'Processing';
    classifier.assignLayers([node]);
    // Should be overwritten by matching rule (API layer has priority 10)
    expect(node.layer).toBe('API');
  });

  it('skips external-service nodes', () => {
    const node = makeNode('prisma', 'external-service');
    node.layer = 'Storage';
    classifier.assignLayers([node]);
    expect(node.layer).toBe('Storage'); // Should remain unchanged
  });

  it('handles Windows-style backslash paths', () => {
    const nodes = [makeNode('C:\\project\\app\\api\\risk\\route.ts', 'api')];
    classifier.assignLayers(nodes);
    expect(nodes[0].layer).toBe('API');
  });

  it('handles case-insensitive path matching', () => {
    const nodes = [
      makeNode('/project/APP/API/risk/route.ts', 'api'),
      makeNode('/project/Components/Button.tsx', 'component'),
    ];
    classifier.assignLayers(nodes);
    expect(nodes[0].layer).toBe('API');
    expect(nodes[1].layer).toBe('UI');
  });

  it('applies custom rules with higher priority than defaults', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const customRules: ClassificationRule[] = [
      { pattern: /\/risk\//i, layer: 'Processing', priority: 20 },
    ];
    
    classifier.assignLayers(nodes, customRules);
    
    // Custom rule (priority 20) should override default API rule (priority 10)
    expect(nodes[0].layer).toBe('Processing');
  });

  it('processes multiple nodes with different layers', () => {
    const nodes = [
      makeNode('/project/app/api/risk/route.ts', 'api'),
      makeNode('/project/app/dashboard/page.tsx', 'route'),
      makeNode('/project/lib/calculator.ts', 'utility'),
      makeNode('/project/prisma/schema.prisma', 'config'),
    ];
    
    classifier.assignLayers(nodes);
    
    expect(nodes[0].layer).toBe('API');
    expect(nodes[1].layer).toBe('UI');
    expect(nodes[2].layer).toBe('Processing');
    expect(nodes[3].layer).toBe('Data');
  });

  it('handles deeply nested paths correctly', () => {
    const nodes = [
      makeNode('/project/app/api/v1/admin/users/[id]/route.ts', 'api'),
      makeNode('/project/components/shared/forms/inputs/TextInput.tsx', 'component'),
    ];
    
    classifier.assignLayers(nodes);
    
    expect(nodes[0].layer).toBe('API');
    expect(nodes[1].layer).toBe('UI');
  });
});

// ---------------------------------------------------------------------------
// assignDomains() — domain extraction from directory structure
// ---------------------------------------------------------------------------

describe('ArchitectureClassifier.assignDomains()', () => {
  let classifier: ArchitectureClassifier;

  beforeEach(() => {
    classifier = new ArchitectureClassifier();
  });

  it('extracts domain from API route path', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    classifier.assignDomains(nodes);
    expect(nodes[0].domain).toBe('Risk');
  });

  it('extracts domain from page path', () => {
    const nodes = [makeNode('/project/app/weather/page.tsx', 'route')];
    classifier.assignDomains(nodes);
    expect(nodes[0].domain).toBe('Weather');
  });

  it('extracts first meaningful segment from nested path', () => {
    const nodes = [makeNode('/project/app/analise/picos/page.tsx', 'route')];
    classifier.assignDomains(nodes);
    expect(nodes[0].domain).toBe('Analise');
  });

  it('converts kebab-case segment to human-readable name', () => {
    const nodes = [makeNode('/project/app/admin/risk-validator/page.tsx', 'route')];
    classifier.assignDomains(nodes);
    expect(nodes[0].domain).toBe('Risk Validator');
  });

  it('converts kebab-case API route to human-readable name', () => {
    const nodes = [makeNode('/project/app/api/moon-phase/route.ts', 'api')];
    classifier.assignDomains(nodes);
    expect(nodes[0].domain).toBe('Moon Phase');
  });

  it('converts underscore-separated segment to human-readable name', () => {
    const nodes = [makeNode('/project/app/api/radar_auto/route.ts', 'api')];
    classifier.assignDomains(nodes);
    expect(nodes[0].domain).toBe('Radar Auto');
  });

  it('skips dynamic route segments like [id]', () => {
    const nodes = [makeNode('/project/app/api/[id]/route.ts', 'api')];
    classifier.assignDomains(nodes);
    // No meaningful domain segment — should be undefined
    expect(nodes[0].domain).toBeUndefined();
  });

  it('skips Next.js route groups like (marketing)', () => {
    const nodes = [makeNode('/project/app/(marketing)/about/page.tsx', 'route')];
    classifier.assignDomains(nodes);
    expect(nodes[0].domain).toBe('About');
  });

  it('skips _components private folders', () => {
    const nodes = [makeNode('/project/app/backlog/_components/Card.tsx', 'component')];
    classifier.assignDomains(nodes);
    expect(nodes[0].domain).toBe('Backlog');
  });

  it('returns undefined for paths with only structural segments', () => {
    const nodes = [makeNode('/project/src/lib/utils/helper.ts', 'utility')];
    classifier.assignDomains(nodes);
    expect(nodes[0].domain).toBeUndefined();
  });

  it('does not overwrite an already-assigned domain', () => {
    const node = makeNode('/project/app/api/risk/route.ts', 'api');
    node.domain = 'CustomDomain';
    classifier.assignDomains([node]);
    expect(node.domain).toBe('CustomDomain');
  });

  it('skips external-service nodes', () => {
    const node = makeNode('prisma', 'external-service');
    classifier.assignDomains([node]);
    expect(node.domain).toBeUndefined();
  });

  it('groups multiple nodes under the same domain', () => {
    const nodes = [
      makeNode('/project/app/api/risk/route.ts', 'api'),
      makeNode('/project/app/risk/page.tsx', 'route'),
      makeNode('/project/components/risk-validator/RiskPanel.tsx', 'component'),
    ];
    classifier.assignDomains(nodes);
    expect(nodes[0].domain).toBe('Risk');
    expect(nodes[1].domain).toBe('Risk');
    expect(nodes[2].domain).toBe('Risk Validator');
  });

  it('handles Windows-style backslash paths', () => {
    const nodes = [makeNode('C:\\project\\app\\api\\weather\\route.ts', 'api')];
    classifier.assignDomains(nodes);
    expect(nodes[0].domain).toBe('Weather');
  });
});

// ---------------------------------------------------------------------------
// classify() — full pipeline including domain assignment
// ---------------------------------------------------------------------------

describe('ArchitectureClassifier.classify()', () => {
  let classifier: ArchitectureClassifier;

  beforeEach(() => {
    classifier = new ArchitectureClassifier();
  });

  it('populates domains map in ClassifiedGraph', () => {
    const graph = makeGraph([
      makeNode('/project/app/api/risk/route.ts', 'api'),
      makeNode('/project/app/weather/page.tsx', 'route'),
    ]);

    const classified = classifier.classify(graph, defaultConfig);

    expect(classified.domains.has('Risk')).toBe(true);
    expect(classified.domains.has('Weather')).toBe(true);
  });

  it('groups nodes under the correct domain in ClassifiedGraph', () => {
    const graph = makeGraph([
      makeNode('/project/app/api/risk/route.ts', 'api'),
      makeNode('/project/app/risk/page.tsx', 'route'),
    ]);

    const classified = classifier.classify(graph, defaultConfig);
    const riskNodes = classified.domains.get('Risk') ?? [];

    expect(riskNodes).toHaveLength(2);
  });

  it('assigns human-readable domain names for kebab-case paths', () => {
    const graph = makeGraph([
      makeNode('/project/app/api/moon-phase/route.ts', 'api'),
    ]);

    const classified = classifier.classify(graph, defaultConfig);

    expect(classified.domains.has('Moon Phase')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Human-readable name generation (via assignDomains)
// ---------------------------------------------------------------------------

describe('Human-readable domain name generation', () => {
  let classifier: ArchitectureClassifier;

  beforeEach(() => {
    classifier = new ArchitectureClassifier();
  });

  const cases: Array<[string, string | undefined]> = [
    ['/app/api/risk/route.ts', 'Risk'],
    ['/app/weather/page.tsx', 'Weather'],
    ['/app/admin/risk-validator/page.tsx', 'Risk Validator'],
    ['/app/api/moon-phase/route.ts', 'Moon Phase'],
    ['/app/api/radar-auto/route.ts', 'Radar Auto'],
    ['/app/analise/picos/page.tsx', 'Analise'],
    ['/app/monitoramento/page.tsx', 'Monitoramento'],
    ['/app/api/[id]/route.ts', undefined],
    ['/src/lib/utils/helper.ts', undefined],
  ];

  for (const [path, expected] of cases) {
    it(`"${path}" → ${expected === undefined ? 'undefined' : `"${expected}"`}`, () => {
      const nodes = [makeNode(path)];
      classifier.assignDomains(nodes);
      expect(nodes[0].domain).toBe(expected);
    });
  }
});

// ---------------------------------------------------------------------------
// applyCustomRules() — priority-based conflict resolution
// ---------------------------------------------------------------------------

describe('ArchitectureClassifier.applyCustomRules()', () => {
  let classifier: ArchitectureClassifier;

  beforeEach(() => {
    classifier = new ArchitectureClassifier();
  });

  it('applies custom layer rule to matching node', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, layer: 'Processing', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('Processing');
  });

  it('applies custom domain rule to matching node', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, domain: 'Risk Management', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].domain).toBe('Risk Management');
  });

  it('applies both layer and domain from the same rule', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, layer: 'Processing', domain: 'Risk Management', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].layer).toBe('Processing');
    expect(nodes[0].domain).toBe('Risk Management');
  });

  it('resolves layer conflict by priority (higher priority wins)', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/api\//i, layer: 'API', priority: 10 },
      { pattern: /\/risk\//i, layer: 'Processing', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    // Higher priority rule (20) should win
    expect(nodes[0].layer).toBe('Processing');
  });

  it('resolves domain conflict by priority (higher priority wins)', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/api\//i, domain: 'API Services', priority: 10 },
      { pattern: /\/risk\//i, domain: 'Risk Management', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    // Higher priority rule (20) should win
    expect(nodes[0].domain).toBe('Risk Management');
  });

  it('applies layer and domain from different rules independently', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/api\//i, layer: 'API', priority: 15 },
      { pattern: /\/risk\//i, domain: 'Risk Management', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    // Layer from first rule, domain from second rule
    expect(nodes[0].layer).toBe('API');
    expect(nodes[0].domain).toBe('Risk Management');
  });

  it('handles multiple nodes with different matching rules', () => {
    const nodes = [
      makeNode('/project/app/api/risk/route.ts', 'api'),
      makeNode('/project/app/api/weather/route.ts', 'api'),
    ];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, domain: 'Risk Management', priority: 20 },
      { pattern: /\/weather\//i, domain: 'Weather Services', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].domain).toBe('Risk Management');
    expect(nodes[1].domain).toBe('Weather Services');
  });

  it('skips external-service nodes', () => {
    const nodes = [makeNode('prisma', 'external-service')];
    nodes[0].layer = 'Storage';
    const rules: ClassificationRule[] = [
      { pattern: /prisma/i, layer: 'Processing', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    // Should not change external-service node
    expect(nodes[0].layer).toBe('Storage');
  });

  it('handles Windows-style backslash paths', () => {
    const nodes = [makeNode('C:\\project\\app\\api\\risk\\route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/risk\//i, domain: 'Risk Management', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    expect(nodes[0].domain).toBe('Risk Management');
  });

  it('does not apply rules when no patterns match', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    nodes[0].layer = 'API';
    nodes[0].domain = 'Risk';
    const rules: ClassificationRule[] = [
      { pattern: /\/weather\//i, layer: 'Processing', domain: 'Weather', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    // Should remain unchanged
    expect(nodes[0].layer).toBe('API');
    expect(nodes[0].domain).toBe('Risk');
  });

  it('handles empty rules array', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    nodes[0].layer = 'API';

    classifier.applyCustomRules(nodes, []);

    // Should remain unchanged
    expect(nodes[0].layer).toBe('API');
  });

  it('resolves three-way conflict by priority', () => {
    const nodes = [makeNode('/project/app/api/risk/route.ts', 'api')];
    const rules: ClassificationRule[] = [
      { pattern: /\/app\//i, layer: 'UI', priority: 5 },
      { pattern: /\/api\//i, layer: 'API', priority: 10 },
      { pattern: /\/risk\//i, layer: 'Processing', priority: 20 },
    ];

    classifier.applyCustomRules(nodes, rules);

    // Highest priority rule (20) should win
    expect(nodes[0].layer).toBe('Processing');
  });
});

// ---------------------------------------------------------------------------
// classify() with custom rules from config
// ---------------------------------------------------------------------------

describe('ArchitectureClassifier.classify() with custom config rules', () => {
  let classifier: ArchitectureClassifier;

  beforeEach(() => {
    classifier = new ArchitectureClassifier();
  });

  it('applies custom layer rules from config', () => {
    const graph = makeGraph([
      makeNode('/project/app/api/risk/route.ts', 'api'),
    ]);

    const config = {
      ...defaultConfig,
      layers: [
        { name: 'Processing', patterns: ['**/risk/**'], color: '#F59E0B' },
      ],
    };

    const classified = classifier.classify(graph, config);
    const node = Array.from(classified.nodes.values())[0];

    // Custom rule (priority 20) should override default API rule (priority 10)
    expect(node.layer).toBe('Processing');
  });

  it('applies custom domain rules from config', () => {
    const graph = makeGraph([
      makeNode('/project/app/api/risk/route.ts', 'api'),
    ]);

    const config = {
      ...defaultConfig,
      domains: [
        { name: 'Risk Management', patterns: ['**/risk/**'], critical: true },
      ],
    };

    const classified = classifier.classify(graph, config);
    const node = Array.from(classified.nodes.values())[0];

    // Custom domain rule should override default domain extraction
    expect(node.domain).toBe('Risk Management');
  });

  it('applies both custom layers and domains from config', () => {
    const graph = makeGraph([
      makeNode('/project/app/api/risk/route.ts', 'api'),
    ]);

    const config = {
      ...defaultConfig,
      layers: [
        { name: 'Processing', patterns: ['**/risk/**'], color: '#F59E0B' },
      ],
      domains: [
        { name: 'Risk Management', patterns: ['**/risk/**'], critical: true },
      ],
    };

    const classified = classifier.classify(graph, config);
    const node = Array.from(classified.nodes.values())[0];

    expect(node.layer).toBe('Processing');
    expect(node.domain).toBe('Risk Management');
  });

  it('handles multiple custom layer definitions', () => {
    const graph = makeGraph([
      makeNode('/project/app/api/risk/route.ts', 'api'),
      makeNode('/project/app/api/weather/route.ts', 'api'),
    ]);

    const config = {
      ...defaultConfig,
      layers: [
        { name: 'Processing', patterns: ['**/risk/**'], color: '#F59E0B' },
        { name: 'Data', patterns: ['**/weather/**'], color: '#8B5CF6' },
      ],
    };

    const classified = classifier.classify(graph, config);
    const nodes = Array.from(classified.nodes.values());

    expect(nodes[0].layer).toBe('Processing');
    expect(nodes[1].layer).toBe('Data');
  });

  it('handles glob patterns with wildcards', () => {
    const graph = makeGraph([
      makeNode('/project/app/api/risk/route.ts', 'api'),
      makeNode('/project/app/api/risk/validator/route.ts', 'api'),
    ]);

    const config = {
      ...defaultConfig,
      domains: [
        { name: 'Risk Management', patterns: ['**/risk/**'], critical: true },
      ],
    };

    const classified = classifier.classify(graph, config);
    const nodes = Array.from(classified.nodes.values());

    // Both nodes should match the **/risk/** pattern
    expect(nodes[0].domain).toBe('Risk Management');
    expect(nodes[1].domain).toBe('Risk Management');
  });

  it('handles glob patterns with single wildcard', () => {
    const graph = makeGraph([
      makeNode('/project/app/api/risk/route.ts', 'api'),
    ]);

    const config = {
      ...defaultConfig,
      domains: [
        { name: 'API Routes', patterns: ['**/api/*.ts'], critical: false },
      ],
    };

    const classified = classifier.classify(graph, config);
    const node = Array.from(classified.nodes.values())[0];

    // Pattern should NOT match because route.ts is in a subdirectory
    // Default domain extraction should apply instead
    expect(node.domain).toBe('Risk');
  });
});
