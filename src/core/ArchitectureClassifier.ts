import { DependencyGraph, GraphNode, ArchitectureLayer } from './DependencyGraph';
import { ProjectConfig } from './FileDiscovery';

/**
 * A rule used to classify nodes into layers or domains.
 */
export interface ClassificationRule {
  pattern: RegExp;
  layer?: ArchitectureLayer;
  domain?: string;
  priority: number;
}

/**
 * A DependencyGraph extended with layer and domain groupings.
 */
export interface ClassifiedGraph extends DependencyGraph {
  layers: Map<ArchitectureLayer, GraphNode[]>;
  domains: Map<string, GraphNode[]>;
}

/**
 * Default classification rules for Next.js conventions.
 * Higher priority number wins when multiple rules match.
 */
export const DEFAULT_CLASSIFICATION_RULES: ClassificationRule[] = [
  // API routes
  { pattern: /\/app\/api\//i,       layer: 'API',        priority: 10 },
  { pattern: /\/pages\/api\//i,     layer: 'API',        priority: 10 },
  // UI pages
  { pattern: /\/app\/.*page\.tsx?$/i,  layer: 'UI',      priority: 8 },
  { pattern: /\/app\/.*layout\.tsx?$/i, layer: 'UI',     priority: 8 },
  { pattern: /\/pages\//i,          layer: 'UI',         priority: 7 },
  { pattern: /\/components\//i,     layer: 'UI',         priority: 7 },
  // Data / Storage
  { pattern: /\/prisma\//i,         layer: 'Data',       priority: 9 },
  { pattern: /\/db\//i,             layer: 'Data',       priority: 9 },
  { pattern: /\/models\//i,         layer: 'Data',       priority: 8 },
  { pattern: /\/schema\//i,         layer: 'Data',       priority: 8 },
  // Processing
  { pattern: /\/lib\//i,            layer: 'Processing', priority: 6 },
  { pattern: /\/utils\//i,          layer: 'Processing', priority: 6 },
  { pattern: /\/services\//i,       layer: 'Processing', priority: 6 },
  { pattern: /\/helpers\//i,        layer: 'Processing', priority: 6 },
];

/**
 * ArchitectureClassifier annotates graph nodes with architecture layers and domains.
 *
 * Responsibilities:
 * - Apply default Next.js classification rules to assign layers
 * - Extract domain names from directory structure
 * - Apply custom rules from ProjectConfig (higher priority wins)
 * - Return a ClassifiedGraph with layer and domain Maps
 */
export class ArchitectureClassifier {
  private defaultRules: ClassificationRule[];

  constructor(defaultRules: ClassificationRule[] = DEFAULT_CLASSIFICATION_RULES) {
    this.defaultRules = defaultRules;
  }

  /**
   * Classifies all nodes in the graph and returns a ClassifiedGraph.
   *
   * @param graph - DependencyGraph to classify
   * @param config - ProjectConfig (may contain custom layer/domain rules)
   * @returns ClassifiedGraph with layers and domains populated
   */
  classify(graph: DependencyGraph, config: ProjectConfig): ClassifiedGraph {
    const nodes = Array.from(graph.nodes.values());

    // Build custom rules from config if provided
    const customRules = this.buildCustomRules(config);

    // Assign layers using default + custom rules
    this.assignLayers(nodes, customRules);

    // Assign domains from directory structure
    this.assignDomains(nodes);

    // Apply any remaining custom domain rules
    if (customRules.length > 0) {
      this.applyCustomRules(nodes, customRules);
    }

    // Build the ClassifiedGraph
    const classifiedGraph = this.buildClassifiedGraph(graph, nodes);

    return classifiedGraph;
  }

  /**
   * Assigns architecture layers to nodes using default rules and optional custom rules.
   * Custom rules with higher priority override default rules.
   *
   * @param nodes - Array of GraphNodes to classify
   * @param customRules - Optional additional rules (from config)
   */
  assignLayers(nodes: GraphNode[], customRules: ClassificationRule[] = []): void {
    const allRules = [...this.defaultRules, ...customRules];

    for (const node of nodes) {
      // Skip external-service nodes — they keep their existing layer
      if (node.type === 'external-service') {
        continue;
      }

      const matchedRule = this.findBestLayerRule(node.id, allRules);
      if (matchedRule?.layer) {
        node.layer = matchedRule.layer;
      } else if (!node.layer) {
        // Fallback: use node type to infer layer
        node.layer = this.inferLayerFromType(node);
      }
    }
  }

  /**
   * Assigns domain names to nodes based on their directory structure.
   * Extracts meaningful path segments as domain identifiers.
   *
   * @param nodes - Array of GraphNodes to assign domains to
   */
  assignDomains(nodes: GraphNode[]): void {
    for (const node of nodes) {
      if (node.type === 'external-service') {
        continue;
      }
      if (!node.domain) {
        node.domain = this.extractDomainFromPath(node.id);
      }
    }
  }

  /**
   * Applies custom classification rules to nodes, overriding existing
   * layer/domain assignments when a rule matches and has sufficient priority.
   * 
   * When multiple rules match the same node:
   * - For layers: the rule with the highest priority wins
   * - For domains: the rule with the highest priority wins
   * 
   * Rules are applied independently for layer and domain assignments,
   * so a node can have its layer set by one rule and domain by another.
   *
   * @param nodes - Array of GraphNodes to update
   * @param rules - Custom ClassificationRules to apply
   */
  applyCustomRules(nodes: GraphNode[], rules: ClassificationRule[]): void {
    for (const node of nodes) {
      // Skip external-service nodes
      if (node.type === 'external-service') {
        continue;
      }

      const normalizedPath = node.id.replace(/\\/g, '/');
      
      // Find all matching rules for this node
      const matchingRules = rules.filter(rule => rule.pattern.test(normalizedPath));
      
      if (matchingRules.length === 0) {
        continue;
      }

      // Find the highest priority rule that defines a layer
      let bestLayerRule: ClassificationRule | undefined;
      for (const rule of matchingRules) {
        if (rule.layer !== undefined) {
          if (!bestLayerRule || rule.priority > bestLayerRule.priority) {
            bestLayerRule = rule;
          }
        }
      }

      // Find the highest priority rule that defines a domain
      let bestDomainRule: ClassificationRule | undefined;
      for (const rule of matchingRules) {
        if (rule.domain !== undefined) {
          if (!bestDomainRule || rule.priority > bestDomainRule.priority) {
            bestDomainRule = rule;
          }
        }
      }

      // Apply the winning rules
      if (bestLayerRule?.layer !== undefined) {
        node.layer = bestLayerRule.layer;
      }
      if (bestDomainRule?.domain !== undefined) {
        node.domain = bestDomainRule.domain;
      }
    }
  }

  /**
   * Finds the highest-priority rule that matches the given node path.
   *
   * @param nodePath - Node ID (file path)
   * @param rules - Rules to search
   * @returns The best matching ClassificationRule, or undefined
   */
  private findBestLayerRule(
    nodePath: string,
    rules: ClassificationRule[]
  ): ClassificationRule | undefined {
    const normalizedPath = nodePath.replace(/\\/g, '/');
    let best: ClassificationRule | undefined;

    for (const rule of rules) {
      if (rule.layer && rule.pattern.test(normalizedPath)) {
        if (!best || rule.priority > best.priority) {
          best = rule;
        }
      }
    }

    return best;
  }

  /**
   * Infers an ArchitectureLayer from the node's type when no rule matches.
   *
   * @param node - GraphNode
   * @returns ArchitectureLayer
   */
  private inferLayerFromType(node: GraphNode): ArchitectureLayer {
    switch (node.type) {
      case 'route':
      case 'component':
        return 'UI';
      case 'api':
        return 'API';
      case 'config':
        return 'Processing';
      case 'utility':
      default:
        return 'Processing';
    }
  }

  /**
   * Extracts a human-readable domain name from a file path.
   * Skips common structural directories and returns the first meaningful segment
   * that appears after a known structural anchor (app, pages, src, components, etc.).
   *
   * Examples:
   *   '/project/app/api/risk/route.ts'         → 'Risk'
   *   '/project/app/weather/page.tsx'           → 'Weather'
   *   '/project/app/analise/picos/page.tsx'     → 'Analise'
   *   '/project/app/admin/risk-validator/...'   → 'Risk Validator'
   *   '/project/lib/risk-calculator.ts'         → undefined (no domain segment)
   *   '/project/app/api/[id]/route.ts'          → undefined (dynamic route only)
   *
   * @param filePath - File path to extract domain from
   * @returns string | undefined
   */
  private extractDomainFromPath(filePath: string): string | undefined {
    const normalized = filePath.replace(/\\/g, '/');
    const segments = normalized.split('/');

    // Structural anchor directories — once we pass one of these, the next
    // meaningful segment is a candidate domain.
    const anchorSegments = new Set([
      'app', 'pages', 'api', 'src', 'components',
    ]);

    // Segments that are structural even after an anchor (skip them too)
    const skipAfterAnchor = new Set([
      'api', 'app', 'pages', 'src', 'components', 'lib',
      'utils', 'services', 'types', 'hooks', 'public',
      'helpers', 'models', 'prisma', 'db', 'schema',
      'node_modules', 'dist', 'build', 'out', 'coverage',
      'static', 'assets', 'styles', 'fonts',
      // Next.js admin/structural sub-directories
      'admin', 'auth', 'middleware',
    ]);

    let pastAnchor = false;

    for (const segment of segments) {
      // Skip empty segments (leading slash produces empty first element)
      if (!segment) continue;
      // Skip file names (contain dots)
      if (segment.includes('.')) continue;
      // Skip hidden directories (e.g. .next, .git)
      if (segment.startsWith('.')) continue;
      // Skip dynamic route segments like [id] or [...slug]
      if (segment.startsWith('[') && segment.endsWith(']')) continue;
      // Skip Next.js route groups like (marketing) or (auth)
      if (segment.startsWith('(') && segment.endsWith(')')) continue;
      // Skip private/internal Next.js folders like _components, _utils
      if (segment.startsWith('_')) continue;
      // Skip very short segments (single chars, abbreviations like "C:")
      if (segment.length <= 2) continue;

      const lower = segment.toLowerCase();

      if (!pastAnchor) {
        // Mark when we've passed a structural anchor
        if (anchorSegments.has(lower)) {
          pastAnchor = true;
        }
        // Before the anchor, skip everything (project root, drive letters, etc.)
        continue;
      }

      // After the anchor: skip further structural directories
      if (skipAfterAnchor.has(lower)) continue;

      return this.toHumanReadableName(segment);
    }

    return undefined;
  }

  /**
   * Converts a path segment into a human-readable name.
   * Handles kebab-case, snake_case, and camelCase conventions.
   *
   * Examples:
   *   'risk'            → 'Risk'
   *   'risk-validator'  → 'Risk Validator'
   *   'moon-phase'      → 'Moon Phase'
   *   'riskValidator'   → 'Risk Validator'
   *   'radar_auto'      → 'Radar Auto'
   *
   * @param segment - Directory name segment
   * @returns Human-readable name string
   */
  private toHumanReadableName(segment: string): string {
    // Split on hyphens, underscores, and camelCase boundaries
    const words = segment
      .replace(/([a-z])([A-Z])/g, '$1 $2')  // camelCase → camel Case
      .split(/[-_\s]+/)                       // split on separators
      .filter(Boolean);

    return words
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Builds custom ClassificationRules from a ProjectConfig.
   * Config layers are converted to rules with priority 20 (higher than defaults).
   * Config domains are converted to rules with priority 15.
   *
   * @param config - ProjectConfig (may be extended with layer/domain definitions)
   * @returns ClassificationRule[]
   */
  private buildCustomRules(config: ProjectConfig): ClassificationRule[] {
    const rules: ClassificationRule[] = [];

    // Check if config has extended properties (layers, domains)
    const extendedConfig = config as any;

    // Convert layer definitions to classification rules
    if (extendedConfig.layers && Array.isArray(extendedConfig.layers)) {
      for (const layerDef of extendedConfig.layers) {
        if (layerDef.name && layerDef.patterns && Array.isArray(layerDef.patterns)) {
          for (const pattern of layerDef.patterns) {
            try {
              const regex = this.globToRegex(pattern);
              rules.push({
                pattern: regex,
                layer: layerDef.name as ArchitectureLayer,
                priority: 20, // Higher than default rules (max 10)
              });
            } catch (err) {
              console.warn(`[ArchitectureClassifier] Invalid pattern "${pattern}" in layer "${layerDef.name}": ${err}`);
            }
          }
        }
      }
    }

    // Convert domain definitions to classification rules
    if (extendedConfig.domains && Array.isArray(extendedConfig.domains)) {
      for (const domainDef of extendedConfig.domains) {
        if (domainDef.name && domainDef.patterns && Array.isArray(domainDef.patterns)) {
          for (const pattern of domainDef.patterns) {
            try {
              const regex = this.globToRegex(pattern);
              rules.push({
                pattern: regex,
                domain: domainDef.name,
                priority: 15, // Higher than default domain extraction
              });
            } catch (err) {
              console.warn(`[ArchitectureClassifier] Invalid pattern "${pattern}" in domain "${domainDef.name}": ${err}`);
            }
          }
        }
      }
    }

    return rules;
  }

  /**
   * Converts a glob pattern to a regular expression.
   * Supports common glob patterns: *, **, ?, and path separators.
   *
   * @param pattern - Glob pattern string (e.g., "** /risk/** ", "*.ts")
   * @returns RegExp - Regular expression for matching file paths
   */
  private globToRegex(pattern: string): RegExp {
    // Handle ** first (before escaping)
    let regexPattern = pattern;
    
    // Replace **/ with a special pattern that matches zero or more directories
    regexPattern = regexPattern.replace(/\*\*\//g, '___DOUBLESTAR_SLASH___');
    
    // Replace /** with a special pattern that matches zero or more directories
    regexPattern = regexPattern.replace(/\/\*\*/g, '___SLASH_DOUBLESTAR___');
    
    // Replace remaining ** with a placeholder
    regexPattern = regexPattern.replace(/\*\*/g, '___DOUBLESTAR___');
    
    // Replace single * with a placeholder (before escaping)
    regexPattern = regexPattern.replace(/\*/g, '___STAR___');
    
    // Replace ? with a placeholder (before escaping)
    regexPattern = regexPattern.replace(/\?/g, '___QUESTION___');
    
    // Escape special regex characters
    regexPattern = regexPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    
    // Replace the placeholders back with proper regex
    regexPattern = regexPattern.replace(/___DOUBLESTAR_SLASH___/g, '(?:.*/)?');
    regexPattern = regexPattern.replace(/___SLASH_DOUBLESTAR___/g, '(?:/.*)?');
    regexPattern = regexPattern.replace(/___DOUBLESTAR___/g, '.*');
    regexPattern = regexPattern.replace(/___STAR___/g, '[^/]*');
    regexPattern = regexPattern.replace(/___QUESTION___/g, '[^/]');

    // Anchor the pattern
    return new RegExp(`^${regexPattern}$`, 'i');
  }

  /**
   * Constructs a ClassifiedGraph from the original graph and classified nodes.
   *
   * @param graph - Original DependencyGraph
   * @param nodes - Classified GraphNodes
   * @returns ClassifiedGraph
   */
  private buildClassifiedGraph(
    graph: DependencyGraph,
    nodes: GraphNode[]
  ): ClassifiedGraph {
    // Build layer map
    const layers = new Map<ArchitectureLayer, GraphNode[]>();
    const allLayers: ArchitectureLayer[] = ['UI', 'API', 'Processing', 'Data', 'Storage'];
    for (const layer of allLayers) {
      layers.set(layer, []);
    }

    // Build domain map
    const domains = new Map<string, GraphNode[]>();

    for (const node of nodes) {
      // Add to layer map
      if (node.layer) {
        const layerNodes = layers.get(node.layer);
        if (layerNodes) {
          layerNodes.push(node);
        }
      }

      // Add to domain map
      if (node.domain) {
        if (!domains.has(node.domain)) {
          domains.set(node.domain, []);
        }
        domains.get(node.domain)!.push(node);
      }
    }

    // Attach layers and domains to the graph object
    const classifiedGraph = graph as ClassifiedGraph;
    classifiedGraph.layers = layers;
    classifiedGraph.domains = domains;

    return classifiedGraph;
  }
}
