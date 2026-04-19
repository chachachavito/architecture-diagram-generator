import { 
  GraphNode, 
  ArchitectureLayer, 
  NodeType, 
  ClassifiedGraph,
  SourcePriority 
} from './GraphTypes';
import { ProjectConfig } from './ConfigValidator';

export { 
  GraphNode, 
  ArchitectureLayer, 
  NodeType, 
  ClassifiedGraph,
  SourcePriority 
};

/**
 * A rule used to classify nodes into layers or domains.
 */
export interface ClassificationRule {
  pattern: RegExp;
  layer?: ArchitectureLayer;
  domain?: string;
  type?: NodeType;
  priority: number;
}

/**
 * Default classification rules for Next.js conventions.
 * Higher priority number wins when multiple rules match.
 */
export const DEFAULT_CLASSIFICATION_RULES: ClassificationRule[] = [
  // API routes
  { pattern: /\/app\/api\//i,       layer: 'API',        type: 'api',     priority: 10 },
  { pattern: /\/pages\/api\//i,     layer: 'API',        type: 'api',     priority: 10 },
  // Action handlers
  { pattern: /\/app\/actions\//i,   layer: 'Action',     type: 'module', priority: 9 },
  // UI components/pages
  { pattern: /\/app\/.*page\.(tsx?|jsx?)$/i,  layer: 'UI',      type: 'module', priority: 8 },
  { pattern: /\/app\/.*layout\.(tsx?|jsx?)$/i, layer: 'UI',     type: 'module', priority: 8 },
  { pattern: /\/pages\//i,          layer: 'UI',         type: 'module',  priority: 7 },
  { pattern: /\/components\//i,     layer: 'UI',         type: 'module',  priority: 7 },
  // Service layer
  { pattern: /\/services\//i,       layer: 'Service',    type: 'service', priority: 6 },
  // Core utilities
  { pattern: /\/lib\//i,            layer: 'Core',       type: 'module',  priority: 5 },
  { pattern: /\/utils\//i,          layer: 'Core',       type: 'module',  priority: 5 },
  // External libraries
  { pattern: /\/libs\//i,           layer: 'External',   type: 'external', priority: 4 },
];

/**
 * ArchitectureClassifier annotates graph nodes with architecture layers and domains.
 */
export class ArchitectureClassifier {
  private defaultRules: ClassificationRule[];

  constructor(defaultRules: ClassificationRule[] = DEFAULT_CLASSIFICATION_RULES) {
    this.defaultRules = defaultRules;
  }

  /**
   * Classifies nodes in the graph.
   */
  classify(nodes: GraphNode[], config: ProjectConfig): void {
    const customRules = this.buildCustomRules(config);

    for (const node of nodes) {
      if (node.metadata.source === 'manual') continue;

      const matchedLayerRule = this.findBestMatch(node.id, customRules, 'layer');
      const defaultLayerRule = this.findBestMatch(node.id, this.defaultRules, 'layer');
      const layerRule = (matchedLayerRule && matchedLayerRule.priority >= (defaultLayerRule?.priority || 0)) 
        ? matchedLayerRule 
        : defaultLayerRule;

      const matchedDomainRule = this.findBestMatch(node.id, customRules, 'domain');
      const defaultDomainRule = this.findBestMatch(node.id, this.defaultRules, 'domain');
      const domainRule = (matchedDomainRule && matchedDomainRule.priority >= (defaultDomainRule?.priority || 0)) 
        ? matchedDomainRule 
        : defaultDomainRule;

      const matchedTypeRule = this.findBestMatch(node.id, customRules, 'type');
      const defaultTypeRule = this.findBestMatch(node.id, this.defaultRules, 'type');
      const typeRule = (matchedTypeRule && matchedTypeRule.priority >= (defaultTypeRule?.priority || 0)) 
        ? matchedTypeRule 
        : defaultTypeRule;

      if (layerRule?.layer) {
        node.metadata.layer = layerRule.layer;
      } else if (!node.metadata.layer) {
        node.metadata.layer = (node.type === 'external' || node.metadata.type === 'external') ? 'External' : 'Core';
      }
      if (domainRule?.domain) node.metadata.domain = domainRule.domain;
      if (typeRule?.type) node.metadata.type = typeRule.type;
      
      if (layerRule || domainRule || typeRule) {
        node.metadata.source = 'inferred';
      }

      if (!node.metadata.domain) {
        node.metadata.domain = this.inferDomainFromPath(node.id);
      }
    }
  }

  private findBestMatch(id: string, rules: ClassificationRule[], property?: keyof ClassificationRule): ClassificationRule | undefined {
    let bestRule: ClassificationRule | undefined;
    for (const rule of rules) {
      if ((!property || rule[property] !== undefined) && rule.pattern.test(id)) {
        if (!bestRule || rule.priority > bestRule.priority) {
          bestRule = rule;
        }
      }
    }
    return bestRule;
  }

  private buildCustomRules(config: ProjectConfig): ClassificationRule[] {
    const rules: ClassificationRule[] = [];
    
    if (config.overrides) {
      for (const override of config.overrides) {
        rules.push({
          pattern: this.globToRegex(override.pattern),
          layer: override.layer as ArchitectureLayer,
          type: override.type,
          domain: override.domain,
          priority: 100 // High priority for manual overrides
        });
      }
    }

    if (config.layers) {
      for (const [layer, patterns] of Object.entries(config.layers)) {
        for (const pattern of patterns) {
          rules.push({
            pattern: this.globToRegex(pattern),
            layer: layer as ArchitectureLayer,
            priority: 50
          });
        }
      }
    }

    return rules;
  }

  private globToRegex(glob: string): RegExp {
    const regex = glob
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
      .replace(/\*\*/g, '.*')               // ** matches anything including /
      .replace(/(?<!\.)\*/g, '[^/]*');      // * matches anything except /
    
    return new RegExp(regex, 'i');
  }

  private inferDomainFromPath(id: string): string {
    const parts = id.split('/');
    // Example: app/billing/page.tsx -> billing
    if (parts.length > 2) {
      if (parts[0] === 'app' || parts[0] === 'src' || parts[0] === 'pages') {
        return parts[1];
      }
    }
    return 'shared';
  }
}
