import { DependencyGraph, GraphNode, GraphEdge, ArchitectureLayer } from './DependencyGraph';

// ---------------------------------------------------------------------------
// Exclusion rules
// ---------------------------------------------------------------------------
const EXCLUDED_TYPES = new Set(['config', 'external-service']);

/**
 * Structural exclusions only — these describe how code is organised, not what
 * it is about. Domain vocabulary belongs in project configuration, never here.
 */
const DEFAULT_EXCLUDED_PATH_PATTERNS: RegExp[] = [
  /\/utils?\//i,
  /\/helpers?\//i,
  /logger/i,
  /\/types?\//i,
  /\/constants?\//i,
  /\/hooks\//i,
  /\/shared\//i,
  // small UI components that are not pages
  /components\/[A-Z]/,
];

const DEFAULT_MAX_ARCHITECTURE_NODES = 40;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface FilterResult {
  graph: DependencyGraph;
  coreNodes: Set<string>;
}

/** Maps path fragments → a canonical domain name, per layer. */
export interface DomainRule {
  patterns: string[];
  domain: string;
}

/** Renames a matching node to a canonical id + label. */
export interface RenameRule {
  pattern: RegExp;
  id: string;
  label: string;
}

export interface ArchitectureFilterOptions {
  /**
   * Per-layer domain vocabulary. Empty by default: the filter will not invent
   * a domain for a module it knows nothing about.
   */
  domainMaps?: {
    API?: DomainRule[];
    UI?: DomainRule[];
    Core?: DomainRule[];
  };
  /** Canonical renames for well-known modules. Empty by default. */
  renames?: RenameRule[];
  /** Overrides the structural path exclusions. */
  excludePathPatterns?: RegExp[];
  /** Node budget before low-priority nodes are dropped. */
  maxNodes?: number;
}

// ---------------------------------------------------------------------------
// ArchitectureFilter
// ---------------------------------------------------------------------------
export class ArchitectureFilter {
  /** idMap from last filter() call — old absolute path → new short id */
  _lastIdMap: Map<string, string> = new Map();

  private readonly domainMaps: Required<NonNullable<ArchitectureFilterOptions['domainMaps']>>;
  private readonly renames: RenameRule[];
  private readonly excludePathPatterns: RegExp[];
  private readonly maxNodes: number;

  constructor(options: ArchitectureFilterOptions = {}) {
    this.domainMaps = {
      API: options.domainMaps?.API ?? [],
      UI: options.domainMaps?.UI ?? [],
      Core: options.domainMaps?.Core ?? [],
    };
    this.renames = options.renames ?? [];
    this.excludePathPatterns = options.excludePathPatterns ?? DEFAULT_EXCLUDED_PATH_PATTERNS;
    this.maxNodes = options.maxNodes ?? DEFAULT_MAX_ARCHITECTURE_NODES;
  }

  filter(fullGraph: DependencyGraph): FilterResult {
    // 1. Filter out excluded nodes
    const allowed = this.filterNodes(fullGraph);

    // 2. Apply canonical renames (core nodes get fixed ids + labels)
    //    _lastIdMap is populated here: oldAbsPath → newId
    const coreNodes = this.applyRenames(allowed);

    // 3. Assign domains per layer
    for (const node of allowed.values()) {
      node.domain = this.inferDomain(node.id, node.layer, node.label);
    }

    // 4. Filter edges — remap to new IDs first, then apply top-down flow filter
    const filteredEdges = this.filterEdges(fullGraph.edges, allowed);

    // 5. Limit size
    const { nodes: limited, edges: limitedEdges } = this.limitSize(allowed, filteredEdges, coreNodes);

    // 6. Assign short stable IDs for non-core nodes (core already renamed)
    this.assignSemanticIds(limited);

    // 7. Remap remaining edge endpoints to final IDs
    const remappedEdges = limitedEdges.map((e) => ({
      ...e,
      from: this._lastIdMap.get(e.from) ?? e.from,
      to:   this._lastIdMap.get(e.to)   ?? e.to,
    }));

    // 8. Deduplicate nodes (same label → merge) and clean edges
    const { nodes: deduped, edges: dedupedEdges } = this.deduplicateNodes(limited, remappedEdges);

    // 9. Build result graph
    const result = new DependencyGraph();
    for (const node of deduped.values()) result.addNode(node);
    for (const edge of dedupedEdges) result.addEdge(edge);

    return { graph: result, coreNodes };
  }

  // ---------------------------------------------------------------------------
  // Step 1 — filter nodes
  // ---------------------------------------------------------------------------
  private filterNodes(graph: DependencyGraph): Map<string, GraphNode> {
    const result = new Map<string, GraphNode>();
    for (const [id, node] of graph.nodes) {
      const nodeType = node.type || node.metadata?.type || 'module';
      if (EXCLUDED_TYPES.has(nodeType)) continue;
      if (this.isExcludedPath(id)) continue;
      result.set(id, { ...node, externalCalls: [] });
    }
    return result;
  }

  private isExcludedPath(filePath: string): boolean {
    const n = filePath.replace(/\\/g, '/');
    return this.excludePathPatterns.some((p) => p.test(n));
  }

  // ---------------------------------------------------------------------------
  // Step 2 — apply canonical renames to core nodes
  // ---------------------------------------------------------------------------
  private applyRenames(nodes: Map<string, GraphNode>): Set<string> {
    const coreIds = new Set<string>();
    // Track which canonical IDs are already taken to avoid collisions
    const usedCanonicalIds = new Set<string>();

    // First pass: assign canonical IDs to matching nodes
    const renames = new Map<string, string>(); // oldId → canonicalId

    for (const [oldId, node] of nodes) {
      for (const { pattern, id: canonicalId, label } of this.renames) {
        if (pattern.test(oldId)) {
          let finalId = canonicalId;
          // Only suffix if another *different* node already claimed this canonical ID
          let counter = 2;
          while (usedCanonicalIds.has(finalId)) {
            finalId = `${canonicalId}_${counter++}`;
          }
          usedCanonicalIds.add(finalId);
          renames.set(oldId, finalId);
          node.label = label;
          coreIds.add(finalId);
          break;
        }
      }
    }

    // Second pass: re-key the map
    const entries = [...nodes.entries()];
    nodes.clear();
    for (const [oldId, node] of entries) {
      const newId = renames.get(oldId) ?? oldId;
      node.id = newId;
      nodes.set(newId, node);
      this._lastIdMap.set(oldId, newId);
    }

    return coreIds;
  }

  // ---------------------------------------------------------------------------
  // Step 3 — infer domain
  // ---------------------------------------------------------------------------
  private inferDomain(
    nodeId: string,
    layer: ArchitectureLayer | undefined,
    label: string | undefined,
  ): string | undefined {
    const n = (nodeId + ' ' + (label ?? '')).toLowerCase().replace(/\\/g, '/');

    const rules =
      layer === 'API'  ? this.domainMaps.API :
      layer === 'UI'   ? this.domainMaps.UI :
      layer === 'Core' ? this.domainMaps.Core :
      [];

    for (const { patterns, domain } of rules) {
      if (patterns.some((p) => n.includes(p.toLowerCase()))) return domain;
    }

    return undefined;
  }

  // ---------------------------------------------------------------------------
  // Step 4 — filter edges (top-down flow only)
  // ---------------------------------------------------------------------------
  private filterEdges(
    edges: GraphEdge[],
    nodes: Map<string, GraphNode>,
  ): GraphEdge[] {
    const ALLOWED: Array<[ArchitectureLayer | undefined, ArchitectureLayer | undefined]> = [
      ['UI',   'API'],
      ['UI',   'Core'],
      ['API',  'Core'],
      ['Core', 'Core'],
      ['Core', 'Core'],
    ];

    const result: GraphEdge[] = [];

    for (const edge of edges) {
      // Remap both endpoints through _lastIdMap (populated in applyRenames)
      const fromId = this._lastIdMap.get(edge.from) ?? edge.from;
      const toId   = this._lastIdMap.get(edge.to)   ?? edge.to;

      if (!nodes.has(fromId) || !nodes.has(toId)) continue;
      if (fromId === toId) continue;

      const fromLayer = nodes.get(fromId)?.layer;
      const toLayer   = nodes.get(toId)?.layer;

      if (ALLOWED.some(([f, t]) => f === fromLayer && t === toLayer)) {
        result.push({ 
          id: `${fromId}->${toId}:${edge.type}`,
          from: fromId, 
          to: toId, 
          type: edge.type 
        });
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Step 5 — limit size
  // ---------------------------------------------------------------------------
  private limitSize(
    nodes: Map<string, GraphNode>,
    edges: GraphEdge[],
    coreNodes: Set<string>,
  ): { nodes: Map<string, GraphNode>; edges: GraphEdge[] } {
    if (nodes.size <= this.maxNodes) return { nodes, edges };

    const priority: Record<string, number> = {
      'external-service': -1, config: 0, utility: 1, component: 2, route: 3, api: 4,
    };

    const sorted = [...nodes.entries()].sort(([idA, a], [idB, b]) => {
      const coreBonus = (coreNodes.has(idB) ? 10 : 0) - (coreNodes.has(idA) ? 10 : 0);
      const typeB = b.type || b.metadata?.type || 'module';
      const typeA = a.type || a.metadata?.type || 'module';
      return coreBonus + (priority[typeB] ?? 0) - (priority[typeA] ?? 0);
    });

    const kept    = new Map(sorted.slice(0, this.maxNodes));
    const keptIds = new Set(kept.keys());
    return {
      nodes: kept,
      edges: edges.filter((e) => keptIds.has(e.from) && keptIds.has(e.to)),
    };
  }

  // ---------------------------------------------------------------------------
  // Step 6 — assign short stable IDs for non-core nodes
  // ---------------------------------------------------------------------------
  private assignSemanticIds(nodes: Map<string, GraphNode>): void {
    // Collect IDs already taken by core nodes
    const usedIds = new Set<string>();
    for (const id of nodes.keys()) usedIds.add(id);

    const entries = [...nodes.entries()];
    nodes.clear();

    for (const [currentId, node] of entries) {
      // A node needs a new short ID if its current ID looks like an absolute path
      // (contains '/' or '\') — core nodes already have clean IDs
      const needsShortId = currentId.includes('/') || currentId.includes('\\');

      if (!needsShortId) {
        // Already a clean ID (core node) — keep as-is
        if (!node.label) node.label = this.makeSemanticLabel(currentId);
        nodes.set(currentId, node);
        continue;
      }

      // Find the original absolute path that maps to this currentId
      // (currentId IS the original path for non-core nodes at this point)
      const shortId = this.makeShortId(currentId, usedIds);
      usedIds.add(shortId);
      this._lastIdMap.set(currentId, shortId);
      node.id = shortId;
      if (!node.label) node.label = this.makeSemanticLabel(currentId);
      nodes.set(shortId, node);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 8 — deduplicate nodes with same label
  // ---------------------------------------------------------------------------
  private deduplicateNodes(
    nodes: Map<string, GraphNode>,
    edges: GraphEdge[],
  ): { nodes: Map<string, GraphNode>; edges: GraphEdge[] } {
    // label → canonical id
    const labelToId = new Map<string, string>();
    const mergeMap  = new Map<string, string>(); // old id → canonical id

    for (const [id, node] of nodes) {
      const key = (node.label ?? id).toLowerCase().trim();
      if (labelToId.has(key)) {
        mergeMap.set(id, labelToId.get(key)!);
      } else {
        labelToId.set(key, id);
        mergeMap.set(id, id);
      }
    }

    // Keep only canonical nodes
    const deduped = new Map<string, GraphNode>();
    for (const [id, node] of nodes) {
      if (mergeMap.get(id) === id) deduped.set(id, node);
    }

    // Remap edges
    const remapped = edges
      .map((e) => ({ ...e, from: mergeMap.get(e.from) ?? e.from, to: mergeMap.get(e.to) ?? e.to }))
      .filter((e) => e.from !== e.to && deduped.has(e.from) && deduped.has(e.to));

    // Deduplicate edges
    const seen = new Set<string>();
    const uniqueEdges = remapped.filter((e) => {
      const key = `${e.from}→${e.to}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return { nodes: deduped, edges: uniqueEdges };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  private makeShortId(filePath: string, used: Set<string>): string {
    const n     = filePath.replace(/\\/g, '/');
    const parts = n.split('/');
    const file  = parts[parts.length - 1].replace(/\.(ts|tsx|js|jsx)$/, '');

    let base: string;
    if (file === 'route' || file === 'index') {
      base = parts[parts.length - 2] ?? file;
    } else if (file === 'page' || file === 'layout') {
      base = (parts[parts.length - 2] ?? file) + '_' + file;
    } else {
      base = file;
    }

    base = base.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (!/^[a-zA-Z]/.test(base)) base = 'n_' + base;

    let id = base;
    let c  = 2;
    while (used.has(id)) id = `${base}_${c++}`;
    return id;
  }

  private makeSemanticLabel(filePath: string): string {
    const n = filePath.replace(/\\/g, '/');
    const parts = n.split('/');
    const basename = parts[parts.length - 1];
    const file = basename.replace(/\.(ts|tsx|js|jsx|css|scss|md)$/, '');

    const genericNames = ['index', 'page', 'route', 'layout', 'styles', 'template', 'loading', 'error', 'not-found'];
    let label: string;

    if (genericNames.includes(file.toLowerCase()) && parts.length > 1) {
      // Take up to 2 context parts + filename
      const contextParts = parts.slice(Math.max(0, parts.length - 3), parts.length - 1);
      label = [...contextParts, file].join(' / ');
    } else {
      label = file;
    }

    return this.sanitizeLabel(this.toTitleCase(label));
  }

  private sanitizeLabel(label: string): string {
    return label
      .replace(/\[([^\]]*)\]/g, '$1')
      .replace(/[{}<>"'()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private toTitleCase(str: string): string {
    return str.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
