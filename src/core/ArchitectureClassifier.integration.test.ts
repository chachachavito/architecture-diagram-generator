import { ArchitectureClassifier } from './ArchitectureClassifier';
import { GraphNode } from './DependencyGraph';

/**
 * Integration test demonstrating the full workflow of custom rule application
 * with priority-based conflict resolution.
 */
describe('ArchitectureClassifier Integration - Custom Rules', () => {
  it('applies custom rules from configuration with priority resolution', () => {
    // Create sample nodes
    const nodes: GraphNode[] = [
      { id: '/project/app/api/risk/route.ts', metadata: { type: 'api', source: 'inferred' } },
      { id: '/project/app/api/weather/route.ts', metadata: { type: 'api', source: 'inferred' } },
      { id: '/project/app/risk/page.tsx', metadata: { type: 'module', source: 'inferred' } },
      { id: '/project/lib/risk-calculator.ts', metadata: { type: 'module', source: 'inferred' } },
      { id: '/project/components/risk-validator/RiskPanel.tsx', metadata: { type: 'module', source: 'inferred' } },
    ];

    // Create a configuration with custom layer and domain rules
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = {
      layers: {
        'Core': ['risk'],
        'Data': ['weather']
      },
      overrides: [
        { pattern: 'risk', domain: 'Risk Management' },
        { pattern: 'weather', domain: 'Weather Services' }
      ]
    };

    // Classify the nodes
    const classifier = new ArchitectureClassifier();
    classifier.classify(nodes, config);

    // Verify metadata
    const riskApiNode = nodes.find(n => n.id === '/project/app/api/risk/route.ts');
    expect(riskApiNode?.metadata.layer).toBe('Core');
    expect(riskApiNode?.metadata.domain).toBe('Risk Management');

    const weatherApiNode = nodes.find(n => n.id === '/project/app/api/weather/route.ts');
    expect(weatherApiNode?.metadata.layer).toBe('Data');
    expect(weatherApiNode?.metadata.domain).toBe('Weather Services');
  });

  it('demonstrates priority-based conflict resolution', () => {
    const nodes: GraphNode[] = [
      { id: '/project/app/api/risk/route.ts', metadata: { type: 'api', source: 'inferred' } }
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = {
      layers: {
        'API': ['**/api/**'],
        'Processing': ['**/risk/**']
      }
    };

    const classifier = new ArchitectureClassifier();
    classifier.classify(nodes, config);

    expect(nodes[0].metadata.layer).toBe('API');
  });
});

/**
 * The pipeline normalises node ids to project-relative paths, so a project
 * whose sources live in a top-level app/ (no src/) yields ids with no leading
 * slash. These must classify exactly like their nested equivalents.
 */
describe('ArchitectureClassifier - project-relative node ids', () => {
  it('classifies top-level Next.js directories without a leading slash', () => {
    const nodes: GraphNode[] = [
      { id: 'app/api/users/route.ts', metadata: { type: 'api', source: 'inferred' } },
      { id: 'app/dashboard/page.tsx', metadata: { type: 'module', source: 'inferred' } },
      { id: 'components/Button.tsx', metadata: { type: 'module', source: 'inferred' } },
      { id: 'services/billing.ts', metadata: { type: 'module', source: 'inferred' } },
      { id: 'lib/auth.ts', metadata: { type: 'module', source: 'inferred' } },
    ];

    new ArchitectureClassifier().classify(nodes, {});

    expect(nodes[0].metadata.layer).toBe('API');
    expect(nodes[1].metadata.layer).toBe('UI');
    expect(nodes[2].metadata.layer).toBe('UI');
    expect(nodes[3].metadata.layer).toBe('Service');
    expect(nodes[4].metadata.layer).toBe('Core');
  });

  it('matches "**/" patterns against files at the project root', () => {
    const nodes: GraphNode[] = [
      { id: 'proxy.ts', metadata: { type: 'module', source: 'inferred' } },
      { id: 'lib/auth.ts', metadata: { type: 'module', source: 'inferred' } },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = {
      layers: { 'API': ['**/proxy.ts'] },
      domains: { 'AccessControl': ['**/proxy.ts', '**/auth.ts'] },
    };

    new ArchitectureClassifier().classify(nodes, config);

    expect(nodes[0].metadata.layer).toBe('API');
    expect(nodes[0].metadata.domain).toBe('AccessControl');
    expect(nodes[1].metadata.domain).toBe('AccessControl');
  });

  it('applies domain patterns from configuration', () => {
    const nodes: GraphNode[] = [
      { id: 'app/billing/page.tsx', metadata: { type: 'module', source: 'inferred' } },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = { domains: { 'Payments': ['**/billing/**'] } };

    new ArchitectureClassifier().classify(nodes, config);

    expect(nodes[0].metadata.domain).toBe('Payments');
  });
});
