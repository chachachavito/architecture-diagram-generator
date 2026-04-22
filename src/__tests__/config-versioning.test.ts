import { describe, it, expect } from 'vitest';
import { ConfigurationLoader, CURRENT_CONFIG_VERSION } from '../core/ConfigurationLoader';

describe('Configuration Versioning', () => {
  it('should return current version correctly', () => {
    const loader = new ConfigurationLoader();
    expect(loader.getCurrentVersion()).toBe(CURRENT_CONFIG_VERSION);
  });

  it('should correctly identify supported versions', () => {
    const loader = new ConfigurationLoader();
    expect(loader.isVersionSupported('1.0.0')).toBe(true);
    expect(loader.isVersionSupported('99.99.99')).toBe(false);
    expect(loader.isVersionSupported('invalid')).toBe(false);
  });

  it('should migrate config without version to current version', () => {
    const loader = new ConfigurationLoader();
    const oldConfig = {
      rootDir: './',
      include: ['src/**'],
    };
    
    const migrated = loader.migrate(oldConfig);
    expect(migrated.version).toBe(CURRENT_CONFIG_VERSION);
    expect(migrated.rootDir).toBe('./');
  });

  it('should not modify config that is already at current version', () => {
    const loader = new ConfigurationLoader();
    const currentConfig = {
      version: CURRENT_CONFIG_VERSION,
      rootDir: './',
    };
    
    const migrated = loader.migrate(currentConfig);
    expect(migrated).toBe(currentConfig); // Reference equality for same version
  });

  it('should emit warnings for unknown versions during validation', () => {
    const loader = new ConfigurationLoader();
    const futureConfig = {
      version: '99.99.99',
      rootDir: './',
    };
    
    const result = loader.validate(futureConfig);
    expect(result.valid).toBe(true); // Still valid structurally
    expect(result.warnings).toBeDefined();
    expect(result.warnings?.[0]).toContain('Unknown config version');
  });

  it('should error when version is not a string', () => {
    const loader = new ConfigurationLoader();
    const badConfig = {
      version: 123,
    };
    
    const result = loader.validate(badConfig);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('"version" must be a string');
  });
});
