import { z } from 'zod';

/**
 * Zod schema for architecture.config.json
 */
export const ConfigSchema = z.object({
  layers: z.record(z.string(), z.array(z.string())).optional(),
  domains: z.record(z.string(), z.array(z.string())).optional(),
  overrides: z.array(z.object({
    pattern: z.string(),
    layer: z.enum(['API', 'Core', 'Data', 'Lib', 'External', 'UI']).optional(),
    type: z.enum(['module', 'service', 'api', 'external']).optional(),
    domain: z.string().optional()
  })).optional(),
  rules: z.array(z.object({
    ruleId: z.string(),
    enabled: z.boolean().default(true),
    severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    thresholds: z.record(z.string(), z.number()).optional(),
    params: z.record(z.string(), z.any()).optional()
  })).optional(),
  disabledRules: z.array(z.string()).optional(),
  analysisScope: z.array(z.string()).optional(),
  performance: z.object({
    maxNodes: z.number().default(1000),
    maxEdges: z.number().default(5000),
    maxCycleDepth: z.number().default(20),
    maxRenderNodes: z.number().default(100)
  }).optional()
});

export type ProjectConfig = z.infer<typeof ConfigSchema>;

/**
 * Validates and normalizes project configuration
 */
export function validateConfig(config: unknown): ProjectConfig {
  try {
    return ConfigSchema.parse(config);
  } catch (error) {
    console.warn('Invalid architecture-config.json, using defaults.', error);
    return ConfigSchema.parse({}); // Return defaults
  }
}
export class ConfigValidator {
  validate(config: unknown): ProjectConfig {
    return validateConfig(config);
  }
}
