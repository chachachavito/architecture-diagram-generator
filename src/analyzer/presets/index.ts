import { AnalyzerConfig, DEFAULT_ANALYZER_CONFIG } from '../AnalyzerConfig';
import { IssueSeverity } from '../../core/GraphTypes';

// ── Preset: Strict ───────────────────────────────────────────────────────────
// For teams that want zero tolerance on architectural issues.
export const PRESET_STRICT: AnalyzerConfig = {
  rules: {
    'layer-violation': { enabled: true, severity: 'critical' as IssueSeverity },
    'circular-dependency': { enabled: true, severity: 'critical' as IssueSeverity },
    'high-fan-out': { enabled: true, severity: 'high' as IssueSeverity, thresholds: { maxFanOut: 6 } },
    'high-fan-in': { enabled: true, severity: 'high' as IssueSeverity, thresholds: { maxFanIn: 8 } },
    'god-module': { enabled: true, severity: 'critical' as IssueSeverity },
  },
  scoring: {
    weights: { critical: 20, high: 10, medium: 5, low: 2 },
  },
  history: DEFAULT_ANALYZER_CONFIG.history,
};

// ── Preset: Balanced (default) ───────────────────────────────────────────────
// Reasonable defaults for most projects.
export const PRESET_BALANCED: AnalyzerConfig = DEFAULT_ANALYZER_CONFIG;

// ── Preset: Relaxed ──────────────────────────────────────────────────────────
// For legacy codebases or initial adoption — higher thresholds, lower penalties.
export const PRESET_RELAXED: AnalyzerConfig = {
  rules: {
    'layer-violation': { enabled: true, severity: 'medium' as IssueSeverity },
    'circular-dependency': { enabled: true, severity: 'high' as IssueSeverity },
    'high-fan-out': { enabled: true, severity: 'low' as IssueSeverity, thresholds: { maxFanOut: 12 } },
    'high-fan-in': { enabled: true, severity: 'low' as IssueSeverity, thresholds: { maxFanIn: 15 } },
    'god-module': { enabled: true, severity: 'medium' as IssueSeverity },
  },
  scoring: {
    weights: { critical: 10, high: 5, medium: 2, low: 0 },
  },
  history: DEFAULT_ANALYZER_CONFIG.history,
};

// ── Registry ─────────────────────────────────────────────────────────────────

export const PRESETS: Record<string, AnalyzerConfig> = {
  strict: PRESET_STRICT,
  balanced: PRESET_BALANCED,
  relaxed: PRESET_RELAXED,
};

export function getPreset(name: string): AnalyzerConfig | null {
  return PRESETS[name] ?? null;
}

export const PRESET_NAMES = Object.keys(PRESETS);
