import { ArchitectureClassifier } from './ArchitectureClassifier';
import { DependencyGraph, GraphNode } from './DependencyGraph';

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
