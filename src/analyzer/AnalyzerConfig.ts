import { z } from 'zod';
import { IssueSeverity } from '../core/GraphTypes';
import { RuleConfig } from './types';

// ── Schema ───────────────────────────────────────────────────────────────────

const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);

const RuleConfigSchema = z.object({
  enabled: z.boolean().default(true),
  severity: SeveritySchema.optional(),
  thresholds: z.record(z.string(), z.number()).optional(),
}).strict();

const ScoringSchema = z.object({
  weights: z.object({
    critical: z.number().default(15),
    high: z.number().default(8),
    medium: z.number().default(3),
    low: z.number().default(1),
  }).optional(),
}).optional();

const HistorySchema = z.object({
  enabled: z.boolean().default(true),
  maxEntries: z.number().default(30),
  directory: z.string().default('.architecture/history'),
}).optional();

export const AnalyzerConfigSchema = z.object({
  rules: z.record(z.string(), RuleConfigSchema).optional(),
  scoring: ScoringSchema,
  history: HistorySchema,
}).strict();

// ── Types ────────────────────────────────────────────────────────────────────

export type AnalyzerConfigInput = z.input<typeof AnalyzerConfigSchema>;
export type AnalyzerConfig = z.output<typeof AnalyzerConfigSchema>;

// ── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_ANALYZER_CONFIG: AnalyzerConfig = {
  rules: {
    'layer-violation': { enabled: true, severity: 'high' as IssueSeverity },
    'circular-dependency': { enabled: true, severity: 'critical' as IssueSeverity },
    'high-fan-out': { enabled: true, severity: 'medium' as IssueSeverity, thresholds: { maxFanOut: 8 } },
    'high-fan-in': { enabled: true, severity: 'medium' as IssueSeverity, thresholds: { maxFanIn: 10 } },
    'god-module': { enabled: true, severity: 'high' as IssueSeverity },
  },
  scoring: {
    weights: { critical: 15, high: 8, medium: 3, low: 1 },
  },
  history: {
    enabled: true,
    maxEntries: 30,
    directory: '.architecture/history',
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse and validate analyzer config, merging with defaults.
 */
export function parseAnalyzerConfig(raw: unknown): AnalyzerConfig {
  const parsed = AnalyzerConfigSchema.parse(raw);
  return mergeConfig(DEFAULT_ANALYZER_CONFIG, parsed);
}

/**
 * Build RuleConfig overrides map from AnalyzerConfig.
 */
export function toRuleOverrides(config: AnalyzerConfig): Record<string, RuleConfig> {
  const overrides: Record<string, RuleConfig> = {};
  if (!config.rules) return overrides;

  for (const [ruleId, ruleCfg] of Object.entries(config.rules)) {
    const cfg = ruleCfg as { enabled: boolean; severity?: string; thresholds?: Record<string, number> };
    overrides[ruleId] = {
      enabled: cfg.enabled,
      severity: (cfg.severity || 'medium') as IssueSeverity,
      thresholds: cfg.thresholds,
    };
  }
  return overrides;
}

function mergeConfig(defaults: AnalyzerConfig, overrides: AnalyzerConfig): AnalyzerConfig {
  return {
    rules: { ...defaults.rules, ...overrides.rules },
    scoring: overrides.scoring ?? defaults.scoring,
    history: overrides.history ?? defaults.history,
  };
}
