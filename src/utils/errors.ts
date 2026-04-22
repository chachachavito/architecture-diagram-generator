/**
 * Custom error classes for the Architecture Diagram Generator
 * Provides descriptive error messages with context information
 */

/**
 * Base error class for all generator errors
 */
export class GeneratorError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'GeneratorError';
    Object.setPrototypeOf(this, GeneratorError.prototype);
  }

  /**
   * Returns a formatted error message with context
   */
  getFormattedMessage(): string {
    let msg = `[${this.code}] ${this.message}`;
    if (this.context) {
      const contextStr = Object.entries(this.context)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      if (contextStr) {
        msg += ` (${contextStr})`;
      }
    }
    return msg;
  }
}

/**
 * Error thrown when a file cannot be read
 */
export class FileReadError extends GeneratorError {
  constructor(filePath: string, originalError: Error) {
    super(
      `Failed to read file: ${filePath}. ${originalError.message}`,
      'FILE_READ_ERROR',
      {
        filePath,
        originalError: originalError.message,
      }
    );
    this.name = 'FileReadError';
    Object.setPrototypeOf(this, FileReadError.prototype);
  }
}

/**
 * Error thrown when a file cannot be written
 */
export class FileWriteError extends GeneratorError {
  constructor(filePath: string, originalError: Error) {
    super(
      `Failed to write file: ${filePath}. ${originalError.message}`,
      'FILE_WRITE_ERROR',
      {
        filePath,
        originalError: originalError.message,
      }
    );
    this.name = 'FileWriteError';
    Object.setPrototypeOf(this, FileWriteError.prototype);
  }
}

/**
 * Error thrown when a file cannot be accessed
 */
export class FileAccessError extends GeneratorError {
  constructor(filePath: string, reason: string = 'Permission denied') {
    super(
      `Cannot access file: ${filePath}. ${reason}`,
      'FILE_ACCESS_ERROR',
      {
        filePath,
        reason,
      }
    );
    this.name = 'FileAccessError';
    Object.setPrototypeOf(this, FileAccessError.prototype);
  }
}

/**
 * Error thrown when parsing TypeScript/JavaScript fails
 */
export class ParseError extends GeneratorError {
  constructor(
    filePath: string,
    message: string,
    lineNumber?: number,
    columnNumber?: number
  ) {
    const location = lineNumber ? ` at line ${lineNumber}${columnNumber ? `, column ${columnNumber}` : ''}` : '';
    super(
      `Parse error in ${filePath}${location}: ${message}`,
      'PARSE_ERROR',
      {
        filePath,
        lineNumber,
        columnNumber,
        message,
      }
    );
    this.name = 'ParseError';
    Object.setPrototypeOf(this, ParseError.prototype);
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends GeneratorError {
  constructor(message: string, configPath?: string) {
    super(
      `Configuration error: ${message}`,
      'CONFIG_ERROR',
      {
        configPath,
      }
    );
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Error thrown when project root is invalid
 */
export class InvalidProjectRootError extends GeneratorError {
  constructor(projectRoot: string) {
    super(
      `Invalid project root: ${projectRoot}. Directory does not exist or is not accessible.`,
      'INVALID_PROJECT_ROOT',
      {
        projectRoot,
      }
    );
    this.name = 'InvalidProjectRootError';
    Object.setPrototypeOf(this, InvalidProjectRootError.prototype);
  }
}

/**
 * Error thrown when no files are found
 */
export class NoFilesFoundError extends GeneratorError {
  constructor(projectRoot: string) {
    super(
      `No TypeScript/JavaScript files found in project: ${projectRoot}. ` +
      `Ensure the project contains source files in app/, pages/, src/, or components/ directories.`,
      'NO_FILES_FOUND',
      {
        projectRoot,
      }
    );
    this.name = 'NoFilesFoundError';
    Object.setPrototypeOf(this, NoFilesFoundError.prototype);
  }
}

/**
 * Error thrown when diagram generation fails
 */
export class DiagramGenerationError extends GeneratorError {
  constructor(message: string, details?: string) {
    super(
      `Failed to generate diagram: ${message}${details ? `. ${details}` : ''}`,
      'DIAGRAM_GENERATION_ERROR',
      {
        message,
        details,
      }
    );
    this.name = 'DiagramGenerationError';
    Object.setPrototypeOf(this, DiagramGenerationError.prototype);
  }
}

/**
 * Error thrown when output directory cannot be created
 */
export class OutputDirectoryError extends GeneratorError {
  constructor(outputDir: string, originalError: Error) {
    super(
      `Failed to create output directory: ${outputDir}. ${originalError.message}`,
      'OUTPUT_DIR_ERROR',
      {
        outputDir,
        originalError: originalError.message,
      }
    );
    this.name = 'OutputDirectoryError';
    Object.setPrototypeOf(this, OutputDirectoryError.prototype);
  }
}

/**
 * Error thrown when a critical operation fails
 */
export class CriticalError extends GeneratorError {
  constructor(message: string, originalError?: Error) {
    super(
      `Critical error: ${message}${originalError ? `. ${originalError.message}` : ''}`,
      'CRITICAL_ERROR',
      {
        originalError: originalError?.message,
      }
    );
    this.name = 'CriticalError';
    Object.setPrototypeOf(this, CriticalError.prototype);
  }
}
