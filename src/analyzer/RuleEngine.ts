import { ClassifiedGraph, Issue } from '../core/GraphTypes';
import { AnalysisRule, RuleConfig } from './types';

/**
 * Executes registered analysis rules against a classified graph.
 */
export class RuleEngine {
  private rules: AnalysisRule[] = [];

  register(rule: AnalysisRule): void {
    this.rules.push(rule);
  }

  registerAll(rules: AnalysisRule[]): void {
    rules.forEach(r => this.register(r));
  }

  execute(graph: ClassifiedGraph, overrides?: Record<string, RuleConfig>): Issue[] {
    const issues: Issue[] = [];

    for (const rule of this.rules) {
      const config = overrides?.[rule.id];
      if (config?.enabled === false) continue;

      const ruleIssues = rule.run(graph, config);
      issues.push(...ruleIssues);
    }

    return issues;
  }

  get registeredRules(): string[] {
    return this.rules.map(r => r.id);
  }
}
