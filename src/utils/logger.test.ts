import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Logger, LogLevel, getLogger, resetLogger } from './logger';

describe('Logger', () => {
  beforeEach(() => {
    resetLogger();
    vi.clearAllMocks();
  });

  describe('Logger initialization', () => {
    it('should create a logger with default log level', () => {
      const logger = new Logger();
      expect(logger).toBeDefined();
    });

    it('should create a logger with custom log level', () => {
      const logger = new Logger(LogLevel.DEBUG);
      expect(logger).toBeDefined();
    });
  });

  describe('Logging methods', () => {
    it('should log debug messages when log level is DEBUG', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const logger = new Logger(LogLevel.DEBUG);
      logger.debug('Debug message');
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('DEBUG');
      consoleSpy.mockRestore();
    });

    it('should log info messages', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const logger = new Logger(LogLevel.INFO);
      logger.info('Info message');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Info message'));
      consoleSpy.mockRestore();
    });

    it('should log warning messages', () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      const logger = new Logger(LogLevel.WARN);
      logger.warn('Warning message');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Warning message'));
      consoleSpy.mockRestore();
    });

    it('should log error messages', () => {
      const consoleSpy = vi.spyOn(console, 'error');
      const logger = new Logger(LogLevel.ERROR);
      logger.error('Error message');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error message'));
      consoleSpy.mockRestore();
    });

    it('should log success messages', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const logger = new Logger();
      logger.success('Success message');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Success message'));
      consoleSpy.mockRestore();
    });
  });

  describe('Progress logging', () => {
    it('should log discovery progress', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const logger = new Logger();
      logger.logDiscoveryProgress(5, 3, 10, 20, 2);
      
      const stats = logger.getStats();
      expect(stats.filesDiscovered).toBe(40);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log parsing progress', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const logger = new Logger();
      logger.logParsingProgress(35, 2, 1500, 10, 25);
      
      const stats = logger.getStats();
      expect(stats.filesParsed).toBe(35);
      expect(stats.parseErrors).toBe(2);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log graph progress', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const logger = new Logger();
      logger.logGraphProgress(45, 120, 5);
      
      const stats = logger.getStats();
      expect(stats.nodesCreated).toBe(45);
      expect(stats.edgesCreated).toBe(120);
      expect(stats.externalServicesDetected).toBe(5);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log diagram progress', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const logger = new Logger();
      logger.logDiagramProgress('architecture', 40, 100);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log output progress', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const logger = new Logger();
      logger.logOutputProgress('/output/architecture.md');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Error logging', () => {
    it('should log parse errors', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const logger = new Logger();
      const errors = [
        { file: 'src/app.ts', error: 'Unexpected token' },
        { file: 'src/utils.ts', error: 'Invalid syntax' },
      ];
      logger.logParseErrors(errors);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should not log parse errors if empty', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const logger = new Logger();
      logger.logParseErrors([]);
      // Should not be called for empty errors
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Summary logging', () => {
    it('should log summary with statistics', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const logger = new Logger();
      
      logger.logDiscoveryProgress(5, 3, 10, 20);
      logger.logParsingProgress(35, 2, 1500);
      logger.logGraphProgress(45, 120, 5);
      logger.logSummary();
      
      const stats = logger.getStats();
      expect(stats.filesDiscovered).toBe(38);
      expect(stats.filesParsed).toBe(35);
      expect(stats.parseErrors).toBe(2);
      expect(stats.nodesCreated).toBe(45);
      expect(stats.edgesCreated).toBe(120);
      expect(stats.externalServicesDetected).toBe(5);
      expect(stats.duration).toBeDefined();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Statistics management', () => {
    it('should get current statistics', () => {
      const logger = new Logger();
      logger.logDiscoveryProgress(5, 3, 10, 20);
      
      const stats = logger.getStats();
      expect(stats.filesDiscovered).toBe(38);
      expect(stats.startTime).toBeDefined();
    });

    it('should reset statistics', () => {
      const logger = new Logger();
      logger.logDiscoveryProgress(5, 3, 10, 20);
      
      let stats = logger.getStats();
      expect(stats.filesDiscovered).toBe(38);
      
      logger.resetStats();
      stats = logger.getStats();
      expect(stats.filesDiscovered).toBe(0);
      expect(stats.filesParsed).toBe(0);
    });
  });

  describe('Global logger', () => {
    it('should get or create global logger instance', () => {
      const logger1 = getLogger();
      const logger2 = getLogger();
      expect(logger1).toBe(logger2);
    });

    it('should reset global logger', () => {
      const logger1 = getLogger();
      resetLogger();
      const logger2 = getLogger();
      expect(logger1).not.toBe(logger2);
    });
  });

  describe('Log level filtering', () => {
    it('should not log debug messages when log level is INFO', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const logger = new Logger(LogLevel.INFO);
      logger.debug('Debug message');
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should not log info messages when log level is WARN', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const logger = new Logger(LogLevel.WARN);
      logger.info('Info message');
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log all messages when log level is DEBUG', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      const consoleErrorSpy = vi.spyOn(console, 'error');
      
      const logger = new Logger(LogLevel.DEBUG);
      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');
      
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
});
