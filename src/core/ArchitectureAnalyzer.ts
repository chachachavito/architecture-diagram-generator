import { 
  GraphSnapshot, 
  NodeMetrics, 
  AnalysisReport, 
  ArchitectureRules, 
  Issue,
  Suggestion
} from './GraphTypes';
import { detectCycles } from './rules/detectCycles';
import { detectGodObject } from './rules/detectGodObject';
import { detectLayerViolation } from './rules/detectLayerViolation';

/**
 * ArchitectureAnalyzer executes pure analysis rules on a graph snapshot.
 */
export class ArchitectureAnalyzer {
  /**
   * Runs the analysis process
   */
  analyze(
    snapshot: GraphSnapshot, 
    metrics: Map<string, NodeMetrics>, 
    rules: ArchitectureRules[]
  ): AnalysisReport {
    const issues: Issue[] = [];
    const suggestions: Suggestion[] = [];

    // Filter and sort rules
    const enabledRules = rules
      .filter(r => r.enabled)
      .sort((a, b) => a.ruleId.localeCompare(b.ruleId));

    for (const rule of enabledRules) {
      let ruleIssues: Issue[] = [];
      
      switch (rule.ruleId) {
        case 'cycles':
          ruleIssues = detectCycles(snapshot, metrics, rule);
          break;
        case 'god-object':
          ruleIssues = detectGodObject(snapshot, metrics, rule);
          break;
        case 'layer-violations':
          ruleIssues = detectLayerViolation(snapshot, metrics, rule);
          break;
      }

      issues.push(...ruleIssues);
    }

    // Deduplicate issues (placeholder logic)
    const uniqueIssues = this.deduplicateIssues(issues);

    // Calculate score (placeholder)
    const score = this.calculateScore(uniqueIssues);

    return {
      issues: uniqueIssues,
      suggestions: this.generateSuggestions(uniqueIssues),
      score,
      summary: {
        totalIssues: uniqueIssues.length,
        criticalIssues: uniqueIssues.filter(i => i.severity === 'critical').length,
        layerViolations: uniqueIssues.filter(i => i.type === 'layer-violation').length,
        cycles: uniqueIssues.filter(i => i.type === 'circular-dependency').length
      }
    };
  }

  private deduplicateIssues(issues: Issue[]): Issue[] {
    const seen = new Set<string>();
    return issues.filter(issue => {
      const key = `${issue.type}:${issue.nodeId}:${issue.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private calculateScore(issues: Issue[]): number {
    let penalty = 0;
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical': penalty += 20; break;
        case 'high': penalty += 10; break;
        case 'medium': penalty += 5; break;
        case 'low': penalty += 2; break;
      }
    }
    return Math.max(0, 100 - penalty);
  }

  private generateSuggestions(issues: Issue[]): Suggestion[] {
    const suggestions: Suggestion[] = [];
    
    // Simple logic: if there are cycles, suggest breaking them
    const cycleIssues = issues.filter(i => i.type === 'circular-dependency');
    if (cycleIssues.length > 0) {
      suggestions.push({
        id: 'suggest-break-cycles',
        relatedIssues: cycleIssues.map(i => i.nodeId),
        message: 'Break circular dependencies by extracting shared logic into a new module in the Lib layer.'
      });
    }

    return suggestions;
  }
}
