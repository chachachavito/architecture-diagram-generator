import { describe, it, expect } from 'vitest';
import {
  GeneratorError,
  FileReadError,
  FileWriteError,
  FileAccessError,
  ParseError,
  ConfigurationError,
  InvalidProjectRootError,
  NoFilesFoundError,
  DiagramGenerationError,
  OutputDirectoryError,
  CriticalError,
} from './errors';

describe('Error Classes', () => {
  describe('GeneratorError', () => {
    it('should create a GeneratorError with code and context', () => {
      const error = new GeneratorError('Test error', 'TEST_CODE', { key: 'value' });
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.context).toEqual({ key: 'value' });
    });

    it('should format error message with context', () => {
      const error = new GeneratorError('Test error', 'TEST_CODE', { file: 'test.ts', line: 10 });
      const formatted = error.getFormattedMessage();
      expect(formatted).toContain('[TEST_CODE]');
      expect(formatted).toContain('Test error');
      expect(formatted).toContain('file: test.ts');
      expect(formatted).toContain('line: 10');
    });
  });

  describe('FileReadError', () => {
    it('should create a FileReadError with file path', () => {
      const originalError = new Error('ENOENT: no such file');
      const error = new FileReadError('src/test.ts', originalError);
      expect(error.message).toContain('Failed to read file');
      expect(error.message).toContain('src/test.ts');
      expect(error.code).toBe('FILE_READ_ERROR');
    });
  });

  describe('FileWriteError', () => {
    it('should create a FileWriteError with file path', () => {
      const originalError = new Error('EACCES: permission denied');
      const error = new FileWriteError('output.md', originalError);
      expect(error.message).toContain('Failed to write file');
      expect(error.message).toContain('output.md');
      expect(error.code).toBe('FILE_WRITE_ERROR');
    });
  });

  describe('FileAccessError', () => {
    it('should create a FileAccessError with reason', () => {
      const error = new FileAccessError('src/config.json', 'Permission denied');
      expect(error.message).toContain('Cannot access file');
      expect(error.message).toContain('src/config.json');
      expect(error.code).toBe('FILE_ACCESS_ERROR');
    });
  });

  describe('ParseError', () => {
    it('should create a ParseError with line and column numbers', () => {
      const error = new ParseError('src/app.ts', 'Unexpected token', 42, 15);
      expect(error.message).toContain('Parse error');
      expect(error.message).toContain('src/app.ts');
      expect(error.message).toContain('line 42');
      expect(error.message).toContain('column 15');
      expect(error.code).toBe('PARSE_ERROR');
    });

    it('should create a ParseError without line/column', () => {
      const error = new ParseError('src/app.ts', 'Unexpected token');
      expect(error.message).toContain('Parse error');
      expect(error.message).toContain('src/app.ts');
      expect(error.code).toBe('PARSE_ERROR');
    });
  });

  describe('ConfigurationError', () => {
    it('should create a ConfigurationError', () => {
      const error = new ConfigurationError('Invalid layer definition', 'config.json');
      expect(error.message).toContain('Configuration error');
      expect(error.code).toBe('CONFIG_ERROR');
    });
  });

  describe('InvalidProjectRootError', () => {
    it('should create an InvalidProjectRootError', () => {
      const error = new InvalidProjectRootError('/nonexistent/path');
      expect(error.message).toContain('Invalid project root');
      expect(error.message).toContain('/nonexistent/path');
      expect(error.code).toBe('INVALID_PROJECT_ROOT');
    });
  });

  describe('NoFilesFoundError', () => {
    it('should create a NoFilesFoundError', () => {
      const error = new NoFilesFoundError('/project');
      expect(error.message).toContain('No TypeScript/JavaScript files found');
      expect(error.message).toContain('/project');
      expect(error.code).toBe('NO_FILES_FOUND');
    });
  });

  describe('DiagramGenerationError', () => {
    it('should create a DiagramGenerationError', () => {
      const error = new DiagramGenerationError('Invalid graph structure', 'Circular dependency detected');
      expect(error.message).toContain('Failed to generate diagram');
      expect(error.code).toBe('DIAGRAM_GENERATION_ERROR');
    });
  });

  describe('OutputDirectoryError', () => {
    it('should create an OutputDirectoryError', () => {
      const originalError = new Error('EACCES: permission denied');
      const error = new OutputDirectoryError('/output/docs', originalError);
      expect(error.message).toContain('Failed to create output directory');
      expect(error.code).toBe('OUTPUT_DIR_ERROR');
    });
  });

  describe('CriticalError', () => {
    it('should create a CriticalError', () => {
      const error = new CriticalError('System failure');
      expect(error.message).toContain('Critical error');
      expect(error.code).toBe('CRITICAL_ERROR');
    });

    it('should include original error message', () => {
      const originalError = new Error('Out of memory');
      const error = new CriticalError('System failure', originalError);
      expect(error.message).toContain('Out of memory');
    });
  });
});
