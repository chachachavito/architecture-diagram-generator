import fs from 'fs/promises';
import path from 'path';

// ─── Version Types ─────────────────────────────────────────────────────────────

/**
 * Current configuration schema version.
 * Increment when making breaking changes to the config schema.
 */
export const CURRENT_CONFIG_VERSION = '1.0.0';

/**
 * Version history for migrations.
 */
export const CONFIG_VERSIONS = ['1.0.0'] as const;

// ─── Extended Type Definitions ────────────────────────────────────────────────

export interface LayerDefinition {
  name: string;
  patterns: string[];
  color?: string;
}

export interface DomainDefinition {
  name: string;
  patterns: string[];
  critical?: boolean;
}

export interface ExternalServiceDefinition {
  name: string;
  patterns: string[];
  type?: string;
}

export type OutputFormat = 'markdown' | 'html' | 'svg';

/**
 * Selects which companion artifacts are written alongside the JSON graph.
 *
 * The JSON itself is not listed: it is the `-o` target, so it is always
 * written. Output location is likewise `-o`'s job — a `directory` here could
 * only contradict it.
 */
export interface OutputConfig {
  formats: OutputFormat[];
}



/**
 * Full project configuration, including all optional advanced fields.
 * The minimal subset (rootDir, include, exclude) is compatible with
 * the ProjectConfig used by FileDiscovery.
 */
export interface FullProjectConfig {
  /** Configuration schema version */
  version?: string;
  rootDir: string;
  include: string[];
  exclude: string[];
  layers: LayerDefinition[];
  domains: DomainDefinition[];
  externalServices: ExternalServiceDefinition[];
  output: OutputConfig;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

// ─── Migration Types ──────────────────────────────────────────────────────────

/**
 * Migration function type.
 */
type MigrationFunction = (config: Record<string, unknown>) => Record<string, unknown>;

/**
 * Map of version -> migration function.
 * Each migration upgrades from the previous version to this version.
 */
const MIGRATIONS: Map<string, MigrationFunction> = new Map([
  // Example migration (for future versions):
  // ['1.1.0', (config) => {
  //   // Add new field with default value
  //   config.newField = config.newField ?? 'default';
  //   return config;
  // }],
]);

// ─── Defaults ─────────────────────────────────────────────────────────────────

/**
 * Config file names searched for, in order, when no explicit path is given.
 */
export const CONFIG_FILE_NAMES = [
  'architecture-config.json',
  'architecture-config.yaml',
  'architecture-config.yml',
] as const;

export const DEFAULT_CONFIG: FullProjectConfig = {
  version: CURRENT_CONFIG_VERSION,
  rootDir: './',
  // Mirrors the directories FileDiscovery scans, so a config file that omits
  // "include" does not silently narrow discovery. Add root-level entrypoints
  // (e.g. "middleware.ts") here to pull them into the graph.
  include: [
    'app/**',
    'pages/**',
    'api/**',
    'src/**',
    'lib/**',
    'components/**',
    'services/**',
    'utils/**',
  ],
  exclude: [
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
    '**/*.stories.tsx',
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/coverage/**',
  ],
  // Mirrors DEFAULT_CLASSIFICATION_RULES, and every name is a real
  // ArchitectureLayer. Both matter: these patterns outrank the classifier's
  // built-in rules, so a config file that omits `layers` must not reclassify
  // the project, and a name outside ArchitectureLayer is skipped wholesale by
  // layer-violation analysis — silently exempting the modules it labels.
  layers: [
    { name: 'UI',      patterns: ['**/app/**/page.tsx', '**/pages/**', '**/components/**'], color: '#3B82F6' },
    { name: 'API',     patterns: ['**/app/api/**', '**/pages/api/**'],                      color: '#10B981' },
    { name: 'Service', patterns: ['**/services/**'],                                        color: '#F59E0B' },
    { name: 'Core',    patterns: ['**/lib/**', '**/utils/**', '**/prisma/**', '**/db/**', '**/models/**'], color: '#8B5CF6' },
  ],
  domains: [],
  externalServices: [],
  // Everything the pipeline can write, so the default is exactly what a run
  // without a config file produces. Narrowing this would silently stop
  // generating artifacts for anyone who merely has a config file.
  output: {
    formats: ['markdown', 'html', 'svg'],
  },
};

// ─── ConfigurationLoader ──────────────────────────────────────────────────────

/**
 * Loads, validates, and merges architecture diagram generator configuration.
 *
 * - Supports JSON config files (YAML support requires js-yaml dependency)
 * - Returns defaults when config file is not found
 * - Warns to console and returns defaults on malformed config
 * - Supports configuration versioning and migrations
 * - Requirements: 4.3, 7.1, 7.6, 7.7, 9.6
 */
export class ConfigurationLoader {
  /**
   * Loads configuration from the given path (or searches for defaults).
   * Falls back to DEFAULT_CONFIG on missing or malformed files.
   *
   * @param configPath - Optional explicit path to config file
   * @returns Merged FullProjectConfig
   */
  async load(configPath?: string, rootDir?: string): Promise<FullProjectConfig> {
    const resolvedPath = configPath ?? await this.resolveConfigPath(rootDir);

    if (!resolvedPath) {
      return { ...DEFAULT_CONFIG };
    }

    let raw: string;
    try {
      raw = await fs.readFile(resolvedPath, 'utf-8');
    } catch {
      // File not found — silently use defaults (Req 7.1: read if present)
      return { ...DEFAULT_CONFIG };
    }

    let parsed: unknown;
    try {
      parsed = this.parseFile(resolvedPath, raw);
    } catch (err) {
      // Malformed config — warn and use defaults (Req 7.7)
      console.warn(
        `[ConfigurationLoader] Warning: Failed to parse config file "${resolvedPath}". ` +
        `Using defaults. Error: ${(err as Error).message}`
      );
      return { ...DEFAULT_CONFIG };
    }

    const validation = this.validate(parsed as FullProjectConfig);
    if (!validation.valid) {
      console.warn(
        `[ConfigurationLoader] Warning: Config file "${resolvedPath}" has validation errors. ` +
        `Using defaults. Errors: ${validation.errors.join(', ')}`
      );
      return { ...DEFAULT_CONFIG };
    }

    // Apply migrations if needed
    const migrated = this.migrate(parsed as Record<string, unknown>);
    
    // Interpolate environment variables
    const interpolated = this.interpolateEnvVars(migrated);
    
    return this.merge(interpolated as Partial<FullProjectConfig>, DEFAULT_CONFIG);
  }

  /**
   * Recursively interpolates environment variables (format: ${VAR_NAME}) in the config object.
   *
   * @param obj - Object or value to interpolate
   * @returns Interpolated object or value
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private interpolateEnvVars(obj: any): any {
    if (typeof obj === 'string') {
      return obj.replace(/\${([^}]+)}/g, (_, envVar) => process.env[envVar] || '');
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.interpolateEnvVars(item));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: Record<string, any> = {};
      for (const key in obj) {
        result[key] = this.interpolateEnvVars(obj[key]);
      }
      return result;
    }
    
    return obj;
  }

  /**
   * Validates the structure of a config object.
   *
   * @param config - Object to validate
   * @returns ValidationResult with valid flag and error messages
   */
  validate(config: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof config !== 'object' || config === null || Array.isArray(config)) {
      return { valid: false, errors: ['Config must be a non-null object'] };
    }

    const c = config as Record<string, unknown>;

    // version (optional)
    if ('version' in c && typeof c.version !== 'string') {
      errors.push('"version" must be a string');
    }

    // Check for unknown version
    if ('version' in c && typeof c.version === 'string') {
      if (!CONFIG_VERSIONS.includes(c.version as typeof CONFIG_VERSIONS[number])) {
        warnings.push(`Unknown config version "${c.version}". Will attempt migration.`);
      }
    }

    // rootDir
    if ('rootDir' in c && typeof c.rootDir !== 'string') {
      errors.push('"rootDir" must be a string');
    }

    // include
    if ('include' in c && !this.isStringArray(c.include)) {
      errors.push('"include" must be an array of strings');
    }

    // exclude
    if ('exclude' in c && !this.isStringArray(c.exclude)) {
      errors.push('"exclude" must be an array of strings');
    }

    // layers
    if ('layers' in c) {
      if (!Array.isArray(c.layers)) {
        errors.push('"layers" must be an array');
      } else {
        c.layers.forEach((layer: unknown, i: number) => {
          if (typeof layer !== 'object' || layer === null) {
            errors.push(`"layers[${i}]" must be an object`);
          } else {
            const l = layer as Record<string, unknown>;
            if (typeof l.name !== 'string') errors.push(`"layers[${i}].name" must be a string`);
            if (!this.isStringArray(l.patterns)) errors.push(`"layers[${i}].patterns" must be an array of strings`);
          }
        });
      }
    }

    // domains
    if ('domains' in c) {
      if (!Array.isArray(c.domains)) {
        errors.push('"domains" must be an array');
      } else {
        c.domains.forEach((domain: unknown, i: number) => {
          if (typeof domain !== 'object' || domain === null) {
            errors.push(`"domains[${i}]" must be an object`);
          } else {
            const d = domain as Record<string, unknown>;
            if (typeof d.name !== 'string') errors.push(`"domains[${i}].name" must be a string`);
            if (!this.isStringArray(d.patterns)) errors.push(`"domains[${i}].patterns" must be an array of strings`);
          }
        });
      }
    }

    // output
    if ('output' in c) {
      if (typeof c.output !== 'object' || c.output === null) {
        errors.push('"output" must be an object');
      } else {
        const o = c.output as Record<string, unknown>;
        if ('formats' in o) {
          if (!Array.isArray(o.formats)) {
            errors.push('"output.formats" must be an array');
          } else {
            const validFormats = new Set(['markdown', 'html', 'svg']);
            o.formats.forEach((f: unknown, i: number) => {
              if (typeof f !== 'string' || !validFormats.has(f)) {
                errors.push(`"output.formats[${i}]" must be one of: markdown, html, svg`);
              }
            });
          }
        }

        // 'directory', 'simplified' and 'detailed' used to live here. Nothing
        // ever read them, so they were removed rather than left as
        // configuration the code ignores.
        for (const dead of ['directory', 'simplified', 'detailed']) {
          if (dead in o) {
            warnings.push(
              `"output.${dead}" is no longer supported and is ignored. ` +
              `Output location is set with the CLI's -o flag.`
            );
          }
        }
      }
    }

    return { 
      valid: errors.length === 0, 
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Merges user-provided partial config with defaults.
   * User values override defaults (Req 7.6).
   *
   * @param userConfig - Partial config from user
   * @param defaults - Default config to fill missing fields
   * @returns Complete FullProjectConfig
   */
  merge(userConfig: Partial<FullProjectConfig>, defaults: FullProjectConfig): FullProjectConfig {
    return {
      version:          CURRENT_CONFIG_VERSION,
      rootDir:          userConfig.rootDir          ?? defaults.rootDir,
      include:          userConfig.include           ?? defaults.include,
      exclude:          userConfig.exclude           ?? defaults.exclude,
      layers:           userConfig.layers            ?? defaults.layers,
      domains:          userConfig.domains           ?? defaults.domains,
      externalServices: userConfig.externalServices  ?? defaults.externalServices,
      output:           userConfig.output
        ? { ...defaults.output, ...userConfig.output }
        : defaults.output,
    };
  }

  /**
   * Migrates a config to the current version.
   * Applies all migrations from the config's version to the current version.
   * This is a public method for testing and advanced use cases.
   *
   * @param config - Config object to migrate
   * @returns Migrated config object
   */
  migrate(config: Record<string, unknown>): Record<string, unknown> {
    // If no version is present, assume it's an old config that needs migration
    const hasVersion = 'version' in config && typeof config.version === 'string';
    const configVersion = hasVersion ? (config.version as string) : '0.0.0';
    
    // If already at current version, no migration needed
    if (configVersion === CURRENT_CONFIG_VERSION) {
      return config;
    }

    // Find the starting index for migrations
    const versionIndex = CONFIG_VERSIONS.indexOf(configVersion as typeof CONFIG_VERSIONS[number]);
    
    // If version not found, assume it's older than all known versions
    const startIndex = versionIndex === -1 ? 0 : versionIndex + 1;

    let migrated = { ...config };

    // Apply migrations in order
    for (let i = startIndex; i < CONFIG_VERSIONS.length; i++) {
      const targetVersion = CONFIG_VERSIONS[i];
      const migration = MIGRATIONS.get(targetVersion);
      
      if (migration) {
        console.log(`[ConfigurationLoader] Migrating config to version ${targetVersion}`);
        migrated = migration(migrated);
        migrated.version = targetVersion;
      }
    }

    // Ensure version is set to current
    migrated.version = CURRENT_CONFIG_VERSION;

    return migrated;
  }

  /**
   * Returns the path of the first config file that actually exists under
   * `rootDir`, or undefined when the project has no config file.
   *
   * Callers use the undefined case to distinguish "no config" from "config
   * that happens to match the defaults" — only the former should leave
   * discovery unfiltered.
   *
   * @param rootDir - Directory to search (defaults to the current working directory)
   */
  async resolveConfigPath(rootDir: string = process.cwd()): Promise<string | undefined> {
    for (const name of CONFIG_FILE_NAMES) {
      const candidate = path.join(rootDir, name);
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        // Not present — try the next candidate
      }
    }
    return undefined;
  }

  /**
   * Gets the current configuration version.
   */
  getCurrentVersion(): string {
    return CURRENT_CONFIG_VERSION;
  }

  /**
   * Checks if a version is supported.
   * @param version - Version to check
   */
  isVersionSupported(version: string): boolean {
    return CONFIG_VERSIONS.includes(version as typeof CONFIG_VERSIONS[number]);
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Parses a config file based on its extension.
   * Currently supports JSON; YAML requires the js-yaml package.
   */
  private parseFile(filePath: string, content: string): unknown {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.json') {
      return JSON.parse(content);
    }
    if (ext === '.yaml' || ext === '.yml') {
      throw new Error(
        'YAML config files are not supported without the js-yaml package. ' +
        'Please use a JSON config file or install js-yaml.'
      );
    }
    // Try JSON as fallback for unknown extensions
    return JSON.parse(content);
  }

  private isStringArray(value: unknown): boolean {
    return Array.isArray(value) && value.every((v) => typeof v === 'string');
  }
}
