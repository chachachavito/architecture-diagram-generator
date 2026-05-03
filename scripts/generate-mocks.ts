import * as fs from 'fs';
import * as path from 'path';

interface Node {
  id: string;
  metadata: {
    label: string;
    layer: string;
    domain: string;
    metrics: { sloc: number; complexity: number };
  };
}

interface Edge {
  id: string;
  from: string;
  to: string;
}

function generateMock(name: string, nodeCount: number) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const layers = ['Core', 'Service', 'UI', 'External', 'Utils'];
  const domains = ['auth', 'billing', 'inventory', 'shared', 'api'];

  // 1. Generate Nodes
  for (let i = 0; i < nodeCount; i++) {
    const layer = layers[Math.floor(Math.random() * layers.length)];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    nodes.push({
      id: `node_${i}`,
      metadata: {
        label: `${layer}Component_${i}`,
        layer,
        domain,
        metrics: {
          sloc: Math.floor(Math.random() * 1000),
          complexity: Math.floor(Math.random() * 50)
        }
      }
    });
  }

  // 2. Generate Edges (Average 3 per node)
  nodes.forEach((node, idx) => {
    const edgeCount = Math.floor(Math.random() * 4) + 1;
    for (let j = 0; j < edgeCount; j++) {
      const targetIdx = Math.floor(Math.random() * nodeCount);
      if (idx !== targetIdx) {
        edges.push({
          id: `edge_${idx}_${targetIdx}_${j}`,
          from: node.id,
          to: nodes[targetIdx].id
        });
      }
    }
  });

  // 3. Add Hub (Highly connected node)
  const hubId = 'node_hub';
  nodes.push({
    id: hubId,
    metadata: {
      label: 'MainSystemHub',
      layer: 'Core',
      domain: 'shared',
      metrics: { sloc: 5000, complexity: 150 }
    }
  });

  for (let i = 0; i < Math.min(nodeCount, 20); i++) {
    edges.push({ id: `edge_hub_${i}`, from: hubId, to: nodes[i].id });
  }

  // 4. Add Edge Cases
  nodes.push({
    id: 'node_orphan',
    metadata: { label: 'OrphanModule', layer: 'Utils', domain: 'shared', metrics: { sloc: 10, complexity: 1 } }
  });

  const mockData = { nodes, edges, version: 'mock-1.0' };
  const fixturesDir = path.join(process.cwd(), 'fixtures');
  if (!fs.existsSync(fixturesDir)) fs.mkdirSync(fixturesDir);
  
  fs.writeFileSync(
    path.join(fixturesDir, `mock-architecture-${name}.json`),
    JSON.stringify(mockData, null, 2)
  );
  console.log(`Generated ${name} mock with ${nodes.length} nodes.`);
}

generateMock('small', 20);
generateMock('medium', 100);
generateMock('large', 300);
