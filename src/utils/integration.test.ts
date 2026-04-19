import { describe, it, expect, beforeEach } from 'vitest';
import { Logger, LogLevel } from './logger';
import {
  GeneratorError,
  FileReadError,
  ParseError,
  InvalidProjectRootError,
  NoFilesFoundError,
} from './errors';

describe('Error Handling and Logging Integration', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger(LogLevel.INFO);
  });

  describe('Error context preservation', () => {
    it('should preserve error context through logging', () => {
      const error = new ParseError('src/app.ts', 'Unexpected token', 42, 15);
      expect(error.context).toEqual({
        filePath: 'src/app.ts',
        lineNumber: 42,
        columnNumber: 15,
        message: 'Unexpected token',
      });
    });

    it('should format error messages with context', () => {
      const error = new FileReadError('config.json', new Error('ENOENT'));
      const formatted = error.getFormattedMessage();
      expect(formatted).toContain('[FILE_READ_ERROR]');
      expect(formatted).toContain('config.json');
    });
  });

  describe('Error types for different scenarios', () => {
    it('should use InvalidProjectRootError for missing directories', () => {
      const error = new InvalidProjectRootError('/missing/path');
      expect(error.code).toBe('INVALID_PROJECT_ROOT');
      expect(error.message).toContain('Invalid project root');
    });

    it('should use NoFilesFoundError when no files are discovered', () => {
      const error = new NoFilesFoundError('/empty/project');
      expect(error.code).toBe('NO_FILES_FOUND');
      expect(error.message).toContain('No TypeScript/JavaScript files found');
    });

    it('should use ParseError for syntax errors with line numbers', () => {
      const error = new ParseError('src/utils.ts', 'Unexpected token }', 100, 5);
      expect(error.code).toBe('PARSE_ERROR');
      expect(error.context?.lineNumber).toBe(100);
      expect(error.context?.columnNumber).toBe(5);
    });
  });

  describe('Statistics tracking', () => {
    it('should track discovery statistics', () => {
      logger.logDiscoveryProgress(10, 5, 20, 30, 2);
      const stats = logger.getStats();
      expect(stats.filesDiscovered).toBe(67);
    });

    it('should track parsing statistics', () => {
      logger.logParsingProgress(60, 3, 2000, 15, 45);
      const stats = logger.getStats();
      expect(stats.filesParsed).toBe(60);
      expect(stats.parseErrors).toBe(3);
    });

    it('should track graph building statistics', () => {
      logger.logGraphProgress(100, 250, 10);
      const stats = logger.getStats();
      expect(stats.nodesCreated).toBe(100);
      expect(stats.edgesCreated).toBe(250);
      expect(stats.externalServicesDetected).toBe(10);
    });

    it('should accumulate statistics across multiple calls', () => {
      logger.logDiscoveryProgress(10, 5, 20, 30);
      logger.logParsingProgress(60, 3, 2000);
      logger.logGraphProgress(100, 250, 10);

      const stats = logger.getStats();
      expect(stats.filesDiscovered).toBe(65);
      expect(stats.filesParsed).toBe(60);
      expect(stats.parseErrors).toBe(3);
      expect(stats.nodesCreated).toBe(100);
      expect(stats.edgesCreated).toBe(250);
      expect(stats.externalServicesDetected).toBe(10);
    });
  });

  describe('Error recovery scenarios', () => {
    it('should handle parse errors gracefully', () => {
      const errors = [
        { file: 'src/app.ts', error: 'Unexpected token at line 42' },
        { file: 'src/utils.ts', error: 'Invalid syntax at line 100' },
      ];
      logger.logParseErrors(errors);
      const stats = logger.getStats();
      expect(stats.parseErrors).toBe(0); // logParseErrors doesn't update stats
    });

    it('should track partial success scenarios', () => {
      logger.logDiscoveryProgress(100, 20, 50, 80, 5);
      logger.logParsingProgress(150, 5, 3000); // 5 files failed to parse
      
      const stats = logger.getStats();
      expect(stats.filesDiscovered).toBe(255);
      expect(stats.filesParsed).toBe(150);
      expect(stats.parseErrors).toBe(5);
    });
  });

  describe('Summary generation', () => {
    it('should generate complete summary with all statistics', () => {
      logger.logDiscoveryProgress(10, 5, 20, 30);
      logger.logParsingProgress(60, 2, 1500);
      logger.logGraphProgress(80, 200, 8);
      logger.logSummary();

      const stats = logger.getStats();
      expect(stats.filesDiscovered).toBe(65);
      expect(stats.filesParsed).toBe(60);
      expect(stats.parseErrors).toBe(2);
      expect(stats.nodesCreated).toBe(80);
      expect(stats.edgesCreated).toBe(200);
      expect(stats.externalServicesDetected).toBe(8);
      expect(stats.duration).toBeDefined();
      expect(stats.endTime).toBeDefined();
    });
  });

  describe('Error message clarity', () => {
    it('should provide actionable error messages', () => {
      const error = new InvalidProjectRootError('/missing/project');
      const message = error.getFormattedMessage();
      expect(message).toContain('Invalid project root');
      expect(message).toContain('/missing/project');
      expect(message).toContain('does not exist');
    });

    it('should include file paths in parse errors', () => {
      const error = new ParseError('src/components/Button.tsx', 'Unexpected token', 50);
      const message = error.getFormattedMessage();
      expect(message).toContain('src/components/Button.tsx');
      expect(message).toContain('line 50');
    });

    it('should preserve original error information', () => {
      const originalError = new Error('EACCES: permission denied');
      const error = new FileReadError('config.json', originalError);
      expect(error.context?.originalError).toContain('permission denied');
    });
  });
});
