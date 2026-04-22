import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { 
  ConfigurationLoader, 
  DEFAULT_CONFIG, 
  FullProjectConfig, 
  CURRENT_CONFIG_VERSION,
} from './ConfigurationLoader';

describe('ConfigurationLoader', () => {
  let loader: ConfigurationLoader;
  const tempDir = './test-config-temp';

  beforeEach(() => {
    loader = new ConfigurationLoader();
  });

  afterEach(async () => {
    // Clean up temp files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('load()', () => {
    it('should return default config when no config path is provided and no default file exists', async () => {
      const config = await loader.load();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should load valid JSON config file', async () => {
      await fs.mkdir(tempDir, { recursive: true });
      const configPath = path.join(tempDir, 'architecture-config.json');
      const userConfig = {
        rootDir: './custom',
        include: ['custom/**'],
      };
      await fs.writeFile(configPath, JSON.stringify(userConfig));

      const config = await loader.load(configPath);
      expect(config.rootDir).toBe('./custom');
      expect(config.include).toEqual(['custom/**']);
      // Other fields should have defaults
      expect(config.exclude).toEqual(DEFAULT_CONFIG.exclude);
    });

    it('should return defaults when config file does not exist', async () => {
      const config = await loader.load('./nonexistent-config.json');
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should return defaults and warn when config file is malformed JSON', async () => {
      await fs.mkdir(tempDir, { recursive: true });
      const configPath = path.join(tempDir, 'bad-config.json');
      await fs.writeFile(configPath, '{ invalid json }');

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const config = await loader.load(configPath);

      expect(config).toEqual(DEFAULT_CONFIG);
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('Failed to parse config file');

      consoleSpy.mockRestore();
    });

    it('should return defaults and warn when config validation fails', async () => {
      await fs.mkdir(tempDir, { recursive: true });
      const configPath = path.join(tempDir, 'invalid-config.json');
      const invalidConfig = {
        rootDir: 123, // Should be string
        include: 'not-an-array', // Should be array
      };
      await fs.writeFile(configPath, JSON.stringify(invalidConfig));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const config = await loader.load(configPath);

      expect(config).toEqual(DEFAULT_CONFIG);
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('validation errors');

      consoleSpy.mockRestore();
    });

    it('should merge loaded config with defaults', async () => {
      await fs.mkdir(tempDir, { recursive: true });
      const configPath = path.join(tempDir, 'partial-config.json');
      const partialConfig = {
        rootDir: './src',
        layers: [{ name: 'Custom', patterns: ['custom/**'] }],
      };
      await fs.writeFile(configPath, JSON.stringify(partialConfig));

      const config = await loader.load(configPath);
      expect(config.rootDir).toBe('./src');
      expect(config.layers).toEqual([{ name: 'Custom', patterns: ['custom/**'] }]);
      expect(config.exclude).toEqual(DEFAULT_CONFIG.exclude);
      expect(config.output).toEqual(DEFAULT_CONFIG.output);
    });

    it('should handle YAML config files with error message', async () => {
      await fs.mkdir(tempDir, { recursive: true });
      const configPath = path.join(tempDir, 'config.yaml');
      await fs.writeFile(configPath, 'rootDir: ./custom');

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const config = await loader.load(configPath);

      expect(config).toEqual(DEFAULT_CONFIG);
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('YAML config files are not supported');

      consoleSpy.mockRestore();
    });
  });

  describe('validate()', () => {
    it('should validate a correct config', () => {
      const validConfig: FullProjectConfig = {
        rootDir: './',
        include: ['app/**'],
        exclude: ['**/*.test.ts'],
        layers: [{ name: 'UI', patterns: ['**/components/**'] }],
        domains: [{ name: 'Risk', patterns: ['**/risk/**'] }],
        externalServices: [{ name: 'API', patterns: ['api.example.com'] }],
        output: {
          formats: ['markdown'],
          directory: './docs',
          simplified: true,
          detailed: false,
        },
      };

      const result = loader.validate(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-object config', () => {
      const result = loader.validate('not an object');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Config must be a non-null object');
    });

    it('should reject null config', () => {
      const result = loader.validate(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Config must be a non-null object');
    });

    it('should reject array config', () => {
      const result = loader.validate([]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Config must be a non-null object');
    });

    it('should validate rootDir as string', () => {
      const result = loader.validate({ rootDir: 123 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"rootDir" must be a string');
    });

    it('should validate include as string array', () => {
      const result = loader.validate({ include: 'not-an-array' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"include" must be an array of strings');
    });

    it('should validate include with non-string elements', () => {
      const result = loader.validate({ include: ['valid', 123] });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"include" must be an array of strings');
    });

    it('should validate exclude as string array', () => {
      const result = loader.validate({ exclude: { pattern: 'test' } });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"exclude" must be an array of strings');
    });

    it('should validate layers as array of objects with name and patterns', () => {
      const result = loader.validate({
        layers: [{ name: 'UI' }], // Missing patterns
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"layers[0].patterns" must be an array of strings');
    });

    it('should reject layers with non-string name', () => {
      const result = loader.validate({
        layers: [{ name: 123, patterns: ['**'] }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"layers[0].name" must be a string');
    });

    it('should reject layers with non-array patterns', () => {
      const result = loader.validate({
        layers: [{ name: 'UI', patterns: 'not-array' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"layers[0].patterns" must be an array of strings');
    });

    it('should validate domains as array of objects with name and patterns', () => {
      const result = loader.validate({
        domains: [{ name: 'Risk' }], // Missing patterns
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"domains[0].patterns" must be an array of strings');
    });

    it('should reject domains with non-string name', () => {
      const result = loader.validate({
        domains: [{ name: true, patterns: ['**'] }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"domains[0].name" must be a string');
    });

    it('should validate output as object', () => {
      const result = loader.validate({ output: 'not-an-object' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"output" must be an object');
    });

    it('should validate output.formats as array of valid format strings', () => {
      const result = loader.validate({
        output: { formats: ['markdown', 'invalid-format'] },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"output.formats[1]" must be one of: markdown, png, svg');
    });

    it('should accept valid output.formats', () => {
      const result = loader.validate({
        output: { formats: ['markdown', 'png', 'svg'] },
      });
      expect(result.valid).toBe(true);
    });

    it('should validate output.directory as string', () => {
      const result = loader.validate({
        output: { directory: 123 },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"output.directory" must be a string');
    });

    it('should validate output.simplified as boolean', () => {
      const result = loader.validate({
        output: { simplified: 'true' },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"output.simplified" must be a boolean');
    });

    it('should validate output.detailed as boolean', () => {
      const result = loader.validate({
        output: { detailed: 1 },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"output.detailed" must be a boolean');
    });

    it('should collect multiple validation errors', () => {
      const result = loader.validate({
        rootDir: 123,
        include: 'not-array',
        exclude: { pattern: 'test' },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain('"rootDir" must be a string');
      expect(result.errors).toContain('"include" must be an array of strings');
      expect(result.errors).toContain('"exclude" must be an array of strings');
    });
  });

  describe('merge()', () => {
    it('should merge user config with defaults', () => {
      const userConfig: Partial<FullProjectConfig> = {
        rootDir: './custom',
        include: ['custom/**'],
      };

      const result = loader.merge(userConfig, DEFAULT_CONFIG);

      expect(result.rootDir).toBe('./custom');
      expect(result.include).toEqual(['custom/**']);
      expect(result.exclude).toEqual(DEFAULT_CONFIG.exclude);
      expect(result.layers).toEqual(DEFAULT_CONFIG.layers);
    });

    it('should use defaults when user config is empty', () => {
      const result = loader.merge({}, DEFAULT_CONFIG);
      expect(result).toEqual(DEFAULT_CONFIG);
    });

    it('should override all default fields with user values', () => {
      const userConfig: Partial<FullProjectConfig> = {
        rootDir: './src',
        include: ['src/**'],
        exclude: ['**/*.test.ts'],
        layers: [{ name: 'Custom', patterns: ['custom/**'] }],
        domains: [{ name: 'Domain', patterns: ['domain/**'] }],
        externalServices: [{ name: 'Service', patterns: ['service'] }],
        output: {
          formats: ['png'],
          directory: './output',
          simplified: false,
          detailed: true,
        },
      };

      const result = loader.merge(userConfig, DEFAULT_CONFIG);

      expect(result.rootDir).toBe('./src');
      expect(result.include).toEqual(['src/**']);
      expect(result.exclude).toEqual(['**/*.test.ts']);
      expect(result.layers).toEqual([{ name: 'Custom', patterns: ['custom/**'] }]);
      expect(result.domains).toEqual([{ name: 'Domain', patterns: ['domain/**'] }]);
      expect(result.externalServices).toEqual([{ name: 'Service', patterns: ['service'] }]);
      expect(result.output).toEqual({
        formats: ['png'],
        directory: './output',
        simplified: false,
        detailed: true,
      });
    });

    it('should merge output config partially', () => {
      const userConfig: Partial<FullProjectConfig> = {
        output: {
          formats: ['svg'],
          directory: './custom-docs',
          simplified: false,
          detailed: false,
        },
      };

      const result = loader.merge(userConfig, DEFAULT_CONFIG);

      expect(result.output.formats).toEqual(['svg']);
      expect(result.output.directory).toBe('./custom-docs');
      expect(result.output.simplified).toBe(false);
      expect(result.output.detailed).toBe(false);
    });

    it('should handle partial output config merge', () => {
      const userConfig: Partial<FullProjectConfig> = {
        output: {
          directory: './new-dir',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as Partial<FullProjectConfig>['output'] as any,
      };

      const result = loader.merge(userConfig, DEFAULT_CONFIG);

      // Should merge output with defaults
      expect(result.output.directory).toBe('./new-dir');
      expect(result.output.formats).toEqual(DEFAULT_CONFIG.output.formats);
      expect(result.output.simplified).toEqual(DEFAULT_CONFIG.output.simplified);
    });

    it('should not mutate default config', () => {
      const userConfig: Partial<FullProjectConfig> = {
        rootDir: './modified',
      };

      const originalDefaults = JSON.stringify(DEFAULT_CONFIG);
      loader.merge(userConfig, DEFAULT_CONFIG);

      expect(JSON.stringify(DEFAULT_CONFIG)).toBe(originalDefaults);
    });

    it('should not mutate user config', () => {
      const userConfig: Partial<FullProjectConfig> = {
        rootDir: './custom',
      };

      const originalUser = JSON.stringify(userConfig);
      loader.merge(userConfig, DEFAULT_CONFIG);

      expect(JSON.stringify(userConfig)).toBe(originalUser);
    });
  });

  describe('integration tests', () => {
    it('should load, validate, and merge a complete config file', async () => {
      await fs.mkdir(tempDir, { recursive: true });
      const configPath = path.join(tempDir, 'full-config.json');
      const fullConfig = {
        rootDir: './app',
        include: ['app/**', 'lib/**'],
        exclude: ['**/*.test.ts', '**/node_modules/**'],
        layers: [
          { name: 'UI', patterns: ['**/components/**'], color: '#3B82F6' },
          { name: 'API', patterns: ['**/api/**'], color: '#10B981' },
        ],
        domains: [
          { name: 'Risk', patterns: ['**/risk/**'], critical: true },
          { name: 'Weather', patterns: ['**/weather/**'] },
        ],
        output: {
          formats: ['markdown', 'png'],
          directory: './docs/architecture',
          simplified: true,
          detailed: true,
        },
      };

      await fs.writeFile(configPath, JSON.stringify(fullConfig));
      const config = await loader.load(configPath);

      expect(config.rootDir).toBe('./app');
      expect(config.include).toEqual(['app/**', 'lib/**']);
      expect(config.layers).toHaveLength(2);
      expect(config.domains).toHaveLength(2);
      expect(config.output.formats).toContain('markdown');
      expect(config.output.formats).toContain('png');
    });

    it('should handle config with only required fields', async () => {
      await fs.mkdir(tempDir, { recursive: true });
      const configPath = path.join(tempDir, 'minimal-config.json');
      const minimalConfig = {
        rootDir: './src',
      };

      await fs.writeFile(configPath, JSON.stringify(minimalConfig));
      const config = await loader.load(configPath);

      expect(config.rootDir).toBe('./src');
      expect(config.include).toEqual(DEFAULT_CONFIG.include);
      expect(config.exclude).toEqual(DEFAULT_CONFIG.exclude);
      expect(config.layers).toEqual(DEFAULT_CONFIG.layers);
    });

    it('should handle empty config file', async () => {
      await fs.mkdir(tempDir, { recursive: true });
      const configPath = path.join(tempDir, 'empty-config.json');
      await fs.writeFile(configPath, '{}');

      const config = await loader.load(configPath);

      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should handle config with extra unknown fields', async () => {
      await fs.mkdir(tempDir, { recursive: true });
      const configPath = path.join(tempDir, 'extra-fields-config.json');
      const configWithExtra = {
        rootDir: './app',
        unknownField: 'should be ignored',
        anotherUnknown: 123,
      };

      await fs.writeFile(configPath, JSON.stringify(configWithExtra));
      const config = await loader.load(configPath);

      expect(config.rootDir).toBe('./app');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((config as any).unknownField).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle file read errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const config = await loader.load('/invalid/path/config.json');

      expect(config).toEqual(DEFAULT_CONFIG);
      consoleSpy.mockRestore();
    });

    it('should handle deeply nested validation errors', () => {
      const result = loader.validate({
        layers: [
          { name: 'UI', patterns: ['**'] },
          { name: 123, patterns: 'not-array' },
          { name: 'API', patterns: ['api/**'] },
        ],
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate empty arrays as valid', () => {
      const result = loader.validate({
        include: [],
        exclude: [],
        layers: [],
        domains: [],
      });

      expect(result.valid).toBe(true);
    });
  });
});

// ─── Configuration Versioning Tests ────────────────────────────────────────────

describe('Configuration Versioning', () => {
  let loader: ConfigurationLoader;
  const tempDir = './test-config-versioning';

  beforeEach(() => {
    loader = new ConfigurationLoader();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe('getCurrentVersion', () => {
    it('should return the current config version', () => {
      expect(loader.getCurrentVersion()).toBe(CURRENT_CONFIG_VERSION);
    });
  });

  describe('isVersionSupported', () => {
    it('should return true for supported versions', () => {
      expect(loader.isVersionSupported('1.0.0')).toBe(true);
    });

    it('should return false for unsupported versions', () => {
      expect(loader.isVersionSupported('0.0.1')).toBe(false);
      expect(loader.isVersionSupported('99.0.0')).toBe(false);
    });
  });

  describe('validate version field', () => {
    it('should accept valid version field', () => {
      const result = loader.validate({
        version: '1.0.0',
        rootDir: './',
      });
      expect(result.valid).toBe(true);
    });

    it('should reject non-string version', () => {
      const result = loader.validate({
        version: 123,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"version" must be a string');
    });

    it('should warn for unknown version', () => {
      const result = loader.validate({
        version: '0.5.0',
      });
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings).toContain('Unknown config version "0.5.0". Will attempt migration.');
    });

    it('should not warn for known version', () => {
      const result = loader.validate({
        version: '1.0.0',
      });
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeUndefined();
    });
  });

  describe('migrate', () => {
    it('should not modify config at current version', () => {
      const config = {
        version: '1.0.0',
        rootDir: './custom',
      };
      const migrated = loader.migrate(config);
      expect(migrated.version).toBe('1.0.0');
      expect(migrated.rootDir).toBe('./custom');
    });

    it('should add version to config without version', () => {
      const config = {
        rootDir: './custom',
      };
      const migrated = loader.migrate(config);
      expect(migrated.version).toBe(CURRENT_CONFIG_VERSION);
    });

    it('should preserve all fields during migration', () => {
      const config = {
        rootDir: './src',
        include: ['app/**'],
        exclude: ['**/*.test.ts'],
        layers: [{ name: 'UI', patterns: ['**/components/**'] }],
      };
      const migrated = loader.migrate(config);
      
      expect(migrated.rootDir).toBe('./src');
      expect(migrated.include).toEqual(['app/**']);
      expect(migrated.exclude).toEqual(['**/*.test.ts']);
      expect(migrated.layers).toEqual([{ name: 'UI', patterns: ['**/components/**'] }]);
    });
  });

  describe('load with versioning', () => {
    it('should load config with version field', async () => {
      await fs.mkdir(tempDir, { recursive: true });
      const configPath = path.join(tempDir, 'versioned-config.json');
      const config = {
        version: '1.0.0',
        rootDir: './versioned',
      };
      await fs.writeFile(configPath, JSON.stringify(config));

      const loaded = await loader.load(configPath);
      expect(loaded.version).toBe('1.0.0');
      expect(loaded.rootDir).toBe('./versioned');
    });

    it('should add version to config without version', async () => {
      await fs.mkdir(tempDir, { recursive: true });
      const configPath = path.join(tempDir, 'unversioned-config.json');
      const config = {
        rootDir: './unversioned',
      };
      await fs.writeFile(configPath, JSON.stringify(config));

      const loaded = await loader.load(configPath);
      expect(loaded.version).toBe(CURRENT_CONFIG_VERSION);
    });
  });

  describe('merge with versioning', () => {
    it('should always set version in merged config', () => {
      const userConfig = {
        rootDir: './custom',
      };
      const result = loader.merge(userConfig, DEFAULT_CONFIG);
      expect(result.version).toBe(CURRENT_CONFIG_VERSION);
    });

    it('should override version in merged config', () => {
      const userConfig = {
        version: '0.5.0', // Old version
        rootDir: './custom',
      };
      const result = loader.merge(userConfig, DEFAULT_CONFIG);
      expect(result.version).toBe(CURRENT_CONFIG_VERSION);
    });
  });
});
