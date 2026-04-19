import { ArchitectureClassifier } from './ArchitectureClassifier';
import { DependencyGraph, GraphNode } from './DependencyGraph';

/**
 * Integration test demonstrating the full workflow of custom rule application
 * with priority-based conflict resolution.
 */
describe('ArchitectureClassifier Integration - Custom Rules', () => {
  it('applies custom rules from configuration with priority resolution', () => {
    // Create a sample graph with nodes from different parts of the application
    const graph = new DependencyGraph();
    
    const nodes: GraphNode[] = [
      { id: '/project/app/api/risk/route.ts', type: 'api', externalCalls: [] },
      { id: '/project/app/api/weather/route.ts', type: 'api', externalCalls: [] },
      { id: '/project/app/risk/page.tsx', type: 'route', externalCalls: [] },
      { id: '/project/lib/risk-calculator.ts', type: 'utility', externalCalls: [] },
      { id: '/project/components/risk-validator/RiskPanel.tsx', type: 'component', externalCalls: [] },
    ];

    for (const node of nodes) {
      graph.addNode(node);
    }

    // Create a configuration with custom layer and domain rules
    const config = {
      rootDir: '/project',
      include: [],
      exclude: [],
      layers: [
        // Custom rule: all risk-related files should be in Processing layer
        { name: 'Processing', patterns: ['**/risk/**', '**/risk-*/**'], color: '#F59E0B' },
        // Custom rule: weather files should be in Data layer
        { name: 'Data', patterns: ['**/weather/**'], color: '#8B5CF6' },
      ],
      domains: [
        // Custom rule: group all risk-related files under "Risk Management" domain
        { name: 'Risk Management', patterns: ['**/risk/**', '**/risk-*/**'], critical: true },
        // Custom rule: group weather files under "Weather Services" domain
        { name: 'Weather Services', patterns: ['**/weather/**'], critical: false },
      ],
    };

    // Classify the graph with custom rules
    const classifier = new ArchitectureClassifier();
    const classified = classifier.classify(graph, config);

    // Verify that custom layer rules were applied (priority 20 > default 10)
    const riskApiNode = Array.from(classified.nodes.values()).find(
      n => n.id === '/project/app/api/risk/route.ts'
    );
    expect(riskApiNode?.layer).toBe('Processing'); // Custom rule overrides default API layer

    const weatherApiNode = Array.from(classified.nodes.values()).find(
      n => n.id === '/project/app/api/weather/route.ts'
    );
    expect(weatherApiNode?.layer).toBe('Data'); // Custom rule overrides default API layer

    // Verify that custom domain rules were applied (priority 15 > default extraction)
    expect(riskApiNode?.domain).toBe('Risk Management');
    expect(weatherApiNode?.domain).toBe('Weather Services');

    // Verify that all risk-related nodes are grouped under the same domain
    const riskPageNode = Array.from(classified.nodes.values()).find(
      n => n.id === '/project/app/risk/page.tsx'
    );
    const riskCalculatorNode = Array.from(classified.nodes.values()).find(
      n => n.id === '/project/lib/risk-calculator.ts'
    );
    const riskValidatorNode = Array.from(classified.nodes.values()).find(
      n => n.id === '/project/components/risk-validator/RiskPanel.tsx'
    );

    expect(riskPageNode?.domain).toBe('Risk Management');
    expect(riskCalculatorNode?.domain).toBe('Risk Management');
    expect(riskValidatorNode?.domain).toBe('Risk Management');

    // Verify that the ClassifiedGraph has the correct domain groupings
    const riskManagementNodes = classified.domains.get('Risk Management') ?? [];
    expect(riskManagementNodes.length).toBe(4); // 4 risk-related nodes

    const weatherServicesNodes = classified.domains.get('Weather Services') ?? [];
    expect(weatherServicesNodes.length).toBe(1); // 1 weather node
  });

  it('demonstrates priority-based conflict resolution', () => {
    // Create a node that matches multiple rules
    const graph = new DependencyGraph();
    const node: GraphNode = {
      id: '/project/app/api/risk/route.ts',
      type: 'api',
      externalCalls: [],
    };
    graph.addNode(node);

    // Create configuration with overlapping rules of different priorities
    // When rules have the same priority, the first matching rule wins
    const config = {
      rootDir: '/project',
      include: [],
      exclude: [],
      layers: [
        // Both rules have priority 20 (custom rules)
        // When priorities are equal, the first matching rule is kept
        { name: 'API', patterns: ['**/api/**'], color: '#10B981' },
        { name: 'Processing', patterns: ['**/risk/**'], color: '#F59E0B' },
      ],
      domains: [
        { name: 'API Services', patterns: ['**/api/**'], critical: false },
        { name: 'Risk Management', patterns: ['**/risk/**'], critical: true },
      ],
    };

    const classifier = new ArchitectureClassifier();
    const classified = classifier.classify(graph, config);

    const classifiedNode = Array.from(classified.nodes.values())[0];

    // When priorities are equal (both 20 for layers, both 15 for domains),
    // the first matching rule wins
    expect(classifiedNode.layer).toBe('API'); // First matching rule with priority 20
    expect(classifiedNode.domain).toBe('API Services'); // First matching rule with priority 15
  });

  it('handles glob patterns correctly', () => {
    const graph = new DependencyGraph();
    
    const nodes: GraphNode[] = [
      { id: '/project/app/api/risk/route.ts', type: 'api', externalCalls: [] },
      { id: '/project/app/api/risk/validator/route.ts', type: 'api', externalCalls: [] },
      { id: '/project/app/api/risk/calculator/advanced/route.ts', type: 'api', externalCalls: [] },
      { id: '/project/app/api/weather/route.ts', type: 'api', externalCalls: [] },
    ];

    for (const node of nodes) {
      graph.addNode(node);
    }

    const config = {
      rootDir: '/project',
      include: [],
      exclude: [],
      domains: [
        // ** should match any number of directory levels
        { name: 'Risk Management', patterns: ['**/risk/**'], critical: true },
      ],
    };

    const classifier = new ArchitectureClassifier();
    const classified = classifier.classify(graph, config);

    // All risk nodes should match the **/risk/** pattern
    const riskNodes = Array.from(classified.nodes.values()).filter(
      n => n.id.includes('/risk/')
    );
    expect(riskNodes.length).toBe(3);
    expect(riskNodes.every(n => n.domain === 'Risk Management')).toBe(true);

    // Weather node should not match
    const weatherNode = Array.from(classified.nodes.values()).find(
      n => n.id.includes('/weather/')
    );
    expect(weatherNode?.domain).not.toBe('Risk Management');
  });
});
