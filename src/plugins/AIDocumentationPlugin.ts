import type { Plugin, PluginHooks } from '../core/PluginManager';
import type { ClassifiedGraph, GraphNode } from '../core';
import type { MermaidDiagram } from '../generators/DiagramGenerator';

// ─── AI Plugin Types ───────────────────────────────────────────────────────────

/**
 * Configuration for the AI documentation plugin.
 */
export interface AIPluginConfig {
  /** API key for the AI service */
  apiKey?: string;
  
  /** AI service to use */
  service?: 'openai' | 'anthropic' | 'mock';
  
  /** Model to use */
  model?: string;
  
  /** Maximum tokens for responses */
  maxTokens?: number;
  
  /** Temperature for generation */
  temperature?: number;
  
  /** Enable/disable the plugin */
  enabled?: boolean;
  
  /** Generate module descriptions */
  generateModuleDescriptions?: boolean;
  
  /** Generate domain descriptions */
  generateDomainDescriptions?: boolean;
  
  /** Suggest architecture improvements */
  suggestImprovements?: boolean;
}

/**
 * AI-generated description for a module.
 */
export interface ModuleDescription {
  moduleId: string;
  description: string;
  suggestedLayer?: string;
  suggestedDomain?: string;
  confidence: number;
}

/**
 * AI-generated description for a domain.
 */
export interface DomainDescription {
  domainName: string;
  description: string;
  modules: string[];
  suggestedImprovements?: string[];
}

/**
 * Architecture improvement suggestion.
 */
export interface ArchitectureImprovement {
  type: 'coupling' | 'cohesion' | 'layering' | 'dependency' | 'general';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedModules?: string[];
  suggestion: string;
}

/**
 * Result of AI analysis.
 */
export interface AIAnalysisResult {
  moduleDescriptions: ModuleDescription[];
  domainDescriptions: DomainDescription[];
  improvements: ArchitectureImprovement[];
  analyzedAt: string;
}

// ─── AI Service Interface ──────────────────────────────────────────────────────

/**
 * Interface for AI service implementations.
 */
interface AIService {
  generateDescription(context: string): Promise<string>;
  suggestImprovements(context: string): Promise<string[]>;
}

// ─── Mock AI Service ───────────────────────────────────────────────────────────

/**
 * Mock AI service for testing without real API calls.
 */
class MockAIService implements AIService {
  async generateDescription(context: string): Promise<string> {
    // Generate a mock description based on context
    const moduleName = context.match(/Module: ([^\n]+)/)?.[1] || 'Unknown';
    return `This module (${moduleName}) handles core functionality within the application architecture.`;
  }

  async suggestImprovements(context: string): Promise<string[]> {
    // Return mock suggestions
    return [
      'Consider extracting common utilities into a shared module',
      'Review dependency direction to ensure proper layering',
    ];
  }
}

// ─── OpenAI Service ────────────────────────────────────────────────────────────

/**
 * OpenAI API service implementation.
 */
class OpenAIService implements AIService {
  private apiKey: string;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config: AIPluginConfig) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';
    this.model = config.model || 'gpt-4o-mini';
    this.maxTokens = config.maxTokens || 500;
    this.temperature = config.temperature || 0.7;
  }

  async generateDescription(context: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert software architect. Generate concise, informative descriptions for code modules. Keep descriptions under 100 words.',
          },
          {
            role: 'user',
            content: `Generate a description for this module:\n\n${context}`,
          },
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  async suggestImprovements(context: string): Promise<string[]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert software architect. Suggest specific, actionable improvements for the architecture. Return a JSON array of strings.',
          },
          {
            role: 'user',
            content: `Suggest architecture improvements for:\n\n${context}`,
          },
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '[]';
    
    try {
      return JSON.parse(content);
    } catch {
      return [content];
    }
  }
}

// ─── AI Documentation Plugin ───────────────────────────────────────────────────

/**
 * Plugin that enhances documentation with AI-generated descriptions and suggestions.
 * 
 * Requirements: 9.2
 */
export class AIDocumentationPlugin implements Plugin {
  name = 'ai-documentation-enhancer';
  version = '1.0.0';
  description = 'Enhances architecture documentation with AI-generated descriptions and improvement suggestions';
  
  hooks: PluginHooks;
  
  private config: AIPluginConfig;
  private service: AIService;
  private analysisResult?: AIAnalysisResult;

  constructor(config: AIPluginConfig = {}) {
    this.config = {
      enabled: true,
      service: 'mock',
      generateModuleDescriptions: true,
      generateDomainDescriptions: true,
      suggestImprovements: true,
      ...config,
    };

    // Initialize AI service
    this.service = this.createService();

    // Set up hooks
    this.hooks = {
      afterClassification: async (graph: ClassifiedGraph) => {
        if (this.config.enabled) {
          await this.analyzeGraph(graph);
        }
      },
      afterGeneration: async (diagram: MermaidDiagram) => {
        if (this.config.enabled && this.analysisResult) {
          this.enhanceDiagram(diagram);
        }
      },
    };
  }

  /**
   * Gets the last analysis result.
   */
  getAnalysisResult(): AIAnalysisResult | undefined {
    return this.analysisResult;
  }

  /**
   * Analyzes the classified graph and generates descriptions.
   */
  async analyzeGraph(graph: ClassifiedGraph): Promise<AIAnalysisResult> {
    const moduleDescriptions: ModuleDescription[] = [];
    const domainDescriptions: DomainDescription[] = [];
    const improvements: ArchitectureImprovement[] = [];

    // Generate module descriptions
    if (this.config.generateModuleDescriptions) {
      const nodes = graph.nodes;
      const total = nodes.length;
      let count = 0;
      
      console.log(`[AIPlugin] Generating descriptions for ${total} modules...`);
      
      // Process in batches of 5 to avoid rate limits
      const batchSize = 5;
      for (let i = 0; i < nodes.length; i += batchSize) {
        const batch = nodes.slice(i, i + batchSize);
        await Promise.all(batch.map(async (node) => {
          try {
            const context = this.buildModuleContext(node);
            const description = await this.service.generateDescription(context);
            
            moduleDescriptions.push({
              moduleId: node.id,
              description,
              suggestedLayer: node.layer || node.metadata?.layer,
              suggestedDomain: node.domain || node.metadata?.domain,
              confidence: 0.8,
            });
          } catch (error) {
            console.warn(`[AIPlugin] Failed to generate description for ${node.id}: ${(error as Error).message}`);
          }
        }));
        
        count += batch.length;
        if (count % 10 === 0 || count === total) {
          console.log(`[AIPlugin] Progress: ${count}/${total} modules analyzed`);
        }
      }
    }

    // Generate domain descriptions
    if (this.config.generateDomainDescriptions) {
      const domainsMap = new Map<string, GraphNode[]>();
      for (const node of graph.nodes) {
        const domain = node.domain || node.metadata?.domain;
        if (domain) {
          if (!domainsMap.has(domain)) domainsMap.set(domain, []);
          domainsMap.get(domain)!.push(node);
        }
      }

      for (const [domain, nodes] of domainsMap) {
        try {
          const context = this.buildDomainContext(domain, nodes);
          const description = await this.service.generateDescription(context);
          
          domainDescriptions.push({
            domainName: domain,
            description,
            modules: nodes.map((n: GraphNode) => n.id),
          });
        } catch (error) {
          console.warn(`[AIPlugin] Failed to generate description for domain ${domain}: ${(error as Error).message}`);
        }
      }
    }

    // Suggest improvements
    if (this.config.suggestImprovements) {
      try {
        const context = this.buildImprovementContext(graph);
        const suggestions = await this.service.suggestImprovements(context);
        
        for (const suggestion of suggestions) {
          improvements.push({
            type: 'general',
            severity: 'medium',
            description: suggestion,
            suggestion,
          });
        }
      } catch (error) {
        console.warn(`[AIPlugin] Failed to generate improvements: ${(error as Error).message}`);
      }
    }

    this.analysisResult = {
      moduleDescriptions,
      domainDescriptions,
      improvements,
      analyzedAt: new Date().toISOString(),
    };

    return this.analysisResult;
  }

  /**
   * Enhances the diagram with AI-generated content.
   */
  private enhanceDiagram(diagram: MermaidDiagram): void {
    if (!this.analysisResult) return;

    // 1. Add AI-generated descriptions as comments in the Mermaid diagram
    const mermaidComments = this.analysisResult.moduleDescriptions
      .slice(0, 10) // Limit to first 10 to avoid cluttering Mermaid source
      .map(d => {
        return d.description
          .split('\n')
          .map((line, i) => i === 0 ? `%% ${d.moduleId}: ${line}` : `%% ${line}`)
          .join('\n');
      })
      .join('\n');

    if (mermaidComments) {
      diagram.syntax = `%% === AI-Generated Descriptions ===\n${mermaidComments}\n%% ==================================\n\n${diagram.syntax}`;
    }

    // 2. Add improvement suggestions as Mermaid comments
    if (this.analysisResult.improvements.length > 0) {
      const mermaidSuggestions = this.analysisResult.improvements
        .map(i => {
          const cleanSuggestion = i.suggestion.replace(/```[a-z]*\n|```/g, '').trim();
          return cleanSuggestion
            .split('\n')
            .map(line => `%% - ${line}`)
            .join('\n');
        })
        .join('\n');
      
      diagram.syntax += `\n\n%% === Suggested Improvements ===\n${mermaidSuggestions}\n%% ==============================`;
    }

    // 3. Populate extraContent with readable Markdown sections
    let markdown = '## Architectural Documentation 🤖\n\n';

    // Module Descriptions Section
    if (this.analysisResult.moduleDescriptions.length > 0) {
      markdown += '### Module Insights\n\n';
      for (const d of this.analysisResult.moduleDescriptions) {
        markdown += `#### ${d.moduleId}\n${d.description}\n\n`;
      }
    }

    // Domain Descriptions Section
    if (this.analysisResult.domainDescriptions.length > 0) {
      markdown += '### Domain Analysis\n\n';
      for (const d of this.analysisResult.domainDescriptions) {
        markdown += `#### 📦 ${d.domainName}\n${d.description}\n\n`;
      }
    }

    // Improvements Section
    if (this.analysisResult.improvements.length > 0) {
      markdown += '### Recommended Improvements\n\n';
      for (const i of this.analysisResult.improvements) {
        const cleanSuggestion = i.suggestion.replace(/```[a-z]*\n|```/g, '').trim();
        markdown += `- ${cleanSuggestion}\n`;
      }
    }

    diagram.extraContent = markdown;
  }

  /**
   * Creates the appropriate AI service based on configuration.
   */
  private createService(): AIService {
    switch (this.config.service) {
      case 'openai':
        return new OpenAIService(this.config);
      case 'anthropic':
        // Would implement Anthropic service here
        console.warn('[AIPlugin] Anthropic service not implemented, using mock');
        return new MockAIService();
      case 'mock':
      default:
        return new MockAIService();
    }
  }

  /**
   * Builds context string for module description generation.
   */
  private buildModuleContext(node: GraphNode): string {
    return `Module: ${node.id}
Type: ${node.type}
Layer: ${node.layer || 'Unknown'}
Domain: ${node.domain || 'Unknown'}
External Calls: ${node.externalCalls?.length || 0}`;
  }

  /**
   * Builds context string for domain description generation.
   */
  private buildDomainContext(domain: string, nodes: GraphNode[]): string {
    return `Domain: ${domain}
Modules: ${nodes.map(n => n.id).join(', ')}
Total Modules: ${nodes.length}`;
  }

  /**
   * Builds context string for improvement suggestions.
   */
  private buildImprovementContext(graph: ClassifiedGraph): string {
    const layersMap = new Map<string, number>();
    for (const node of graph.nodes) {
      const layer = node.layer || node.metadata?.layer || 'Unknown';
      layersMap.set(layer, (layersMap.get(layer) || 0) + 1);
    }
    
    const layerInfo = Array.from(layersMap.entries())
      .map(([l, count]) => `${l}: ${count} modules`)
      .join('\n');
    
    return `Architecture Analysis:
Total Nodes: ${graph.nodes.length}
Total Edges: ${graph.edges.length}

Layers:
${layerInfo}

Please suggest specific improvements for this architecture.`;
  }
}

// ─── Plugin Factory ────────────────────────────────────────────────────────────

/**
 * Factory function to create the AI documentation plugin.
 */
export function createAIDocumentationPlugin(config?: AIPluginConfig): Plugin {
  return new AIDocumentationPlugin(config);
}
