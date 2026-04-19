# Error Handling and Logging System

## Overview

The Architecture Diagram Generator includes a comprehensive error handling and logging system that provides:

1. **Descriptive Error Messages** - Clear, actionable error messages with context information
2. **File Path and Line Number Tracking** - Parse errors include exact file locations
3. **Progress Logging** - Real-time progress updates during file discovery and parsing
4. **Summary Statistics** - Detailed statistics about the generation process

## Error Classes

### GeneratorError (Base Class)

All custom errors extend `GeneratorError` which provides:
- Error code for programmatic handling
- Context object with relevant details
- Formatted error messages with context

```typescript
const error = new GeneratorError('Something went wrong', 'ERROR_CODE', {
  file: 'src/app.ts',
  line: 42
});

console.log(error.getFormattedMessage());
// Output: [ERROR_CODE] Something went wrong (file: src/app.ts, line: 42)
```

### Specific Error Types

#### FileReadError
Thrown when a file cannot be read.

```typescript
try {
  await fs.readFile(filePath);
} catch (error) {
  throw new FileReadError(filePath, error);
}
```

**Example Output:**
```
[FILE_READ_ERROR] Failed to read file: src/config.json. ENOENT: no such file or directory
```

#### FileWriteError
Thrown when a file cannot be written.

```typescript
try {
  await fs.writeFile(outputPath, content);
} catch (error) {
  throw new FileWriteError(outputPath, error);
}
```

**Example Output:**
```
[FILE_WRITE_ERROR] Failed to write file: output.md. EACCES: permission denied
```

#### FileAccessError
Thrown when a file cannot be accessed.

```typescript
throw new FileAccessError('src/config.json', 'Permission denied');
```

**Example Output:**
```
[FILE_ACCESS_ERROR] Cannot access file: src/config.json. Permission denied
```

#### ParseError
Thrown when parsing TypeScript/JavaScript fails. Includes line and column numbers.

```typescript
throw new ParseError('src/app.ts', 'Unexpected token', 42, 15);
```

**Example Output:**
```
[PARSE_ERROR] Parse error in src/app.ts at line 42, column 15: Unexpected token
```

#### ConfigurationError
Thrown when configuration is invalid.

```typescript
throw new ConfigurationError('Invalid layer definition', 'config.json');
```

**Example Output:**
```
[CONFIG_ERROR] Configuration error: Invalid layer definition
```

#### InvalidProjectRootError
Thrown when the project root directory doesn't exist or is inaccessible.

```typescript
throw new InvalidProjectRootError('/nonexistent/path');
```

**Example Output:**
```
[INVALID_PROJECT_ROOT] Invalid project root: /nonexistent/path. Directory does not exist or is not accessible.
```

#### NoFilesFoundError
Thrown when no TypeScript/JavaScript files are found in the project.

```typescript
throw new NoFilesFoundError('/project');
```

**Example Output:**
```
[NO_FILES_FOUND] No TypeScript/JavaScript files found in project: /project. Ensure the project contains source files in app/, pages/, src/, or components/ directories.
```

#### DiagramGenerationError
Thrown when diagram generation fails.

```typescript
throw new DiagramGenerationError('Invalid graph structure', 'Circular dependency detected');
```

**Example Output:**
```
[DIAGRAM_GENERATION_ERROR] Failed to generate diagram: Invalid graph structure. Circular dependency detected
```

#### OutputDirectoryError
Thrown when the output directory cannot be created.

```typescript
try {
  await fs.mkdir(outputDir);
} catch (error) {
  throw new OutputDirectoryError(outputDir, error);
}
```

**Example Output:**
```
[OUTPUT_DIR_ERROR] Failed to create output directory: /output/docs. EACCES: permission denied
```

#### CriticalError
Thrown for critical system failures.

```typescript
throw new CriticalError('System failure', originalError);
```

**Example Output:**
```
[CRITICAL_ERROR] Critical error: System failure. Out of memory
```

## Logging System

### Logger Class

The `Logger` class provides structured logging with progress tracking and statistics.

#### Log Levels

```typescript
enum LogLevel {
  DEBUG = 0,    // Detailed debugging information
  INFO = 1,     // General information messages
  WARN = 2,     // Warning messages
  ERROR = 3,    // Error messages
}
```

#### Basic Logging Methods

```typescript
const logger = new Logger(LogLevel.INFO);

logger.debug('Debug message');      // Only shown at DEBUG level
logger.info('Info message');        // General information
logger.warn('Warning message');     // Warnings
logger.error('Error message');      // Errors
logger.success('Success message');  // Success messages
```

#### Progress Logging

##### File Discovery Progress

```typescript
logger.logDiscoveryProgress(
  routesCount,      // Number of route files
  apiCount,         // Number of API files
  componentsCount,  // Number of component files
  utilitiesCount,   // Number of utility files
  configCount       // Number of config files (optional)
);
```

**Example Output:**
```
📋 File Discovery
─────────────────
  └─ Total files found: 106
  └─ Routes: 12
  └─ API endpoints: 24
  └─ Components: 41
  └─ Utilities: 29
```

##### File Parsing Progress

```typescript
logger.logParsingProgress(
  parsedCount,      // Number of successfully parsed files
  errorCount,       // Number of parse errors
  duration,         // Duration in milliseconds
  cacheHits,        // Cache hits (optional)
  cacheMisses       // Cache misses (optional)
);
```

**Example Output:**
```
📋 File Parsing
───────────────
  └─ Successfully parsed: 106 files
  └─ Duration: 130ms
  └─ Cache: 0 hits, 106 misses (0.0% hit rate)
```

##### Dependency Graph Progress

```typescript
logger.logGraphProgress(
  nodeCount,                    // Total nodes in graph
  edgeCount,                    // Total edges in graph
  externalServiceCount          // External services detected
);
```

**Example Output:**
```
📋 Dependency Graph
───────────────────
  └─ Nodes created: 155
  └─ Edges created: 306
  └─ External services detected: 49
```

##### Diagram Generation Progress

```typescript
logger.logDiagramProgress(
  mode,             // 'architecture' or 'full'
  nodeCount,        // Nodes in final diagram
  edgeCount         // Edges in final diagram
);
```

**Example Output:**
```
📋 Diagram Generation
─────────────────────
  └─ Mode: architecture (filtered, 19 core nodes)
  └─ Nodes in diagram: 39
  └─ Edges in diagram: 46
```

##### Output Progress

```typescript
logger.logOutputProgress(outputPath);
```

**Example Output:**
```
📋 Output
─────────
  └─ Saved to: /tmp/test-architecture.md
```

##### Parse Errors

```typescript
logger.logParseErrors([
  { file: 'src/app.ts', error: 'Unexpected token' },
  { file: 'src/utils.ts', error: 'Invalid syntax' }
]);
```

**Example Output:**
```
📋 Parse Errors
───────────────
  └─ src/app.ts: Unexpected token
  └─ src/utils.ts: Invalid syntax
```

##### Summary

```typescript
logger.logSummary();
```

**Example Output:**
```
📋 Summary
──────────
  └─ Files discovered: 106
  └─ Files parsed: 106
  └─ Nodes created: 155
  └─ Edges created: 306
  └─ External services: 49
  └─ Total duration: 179ms

✅ Generation complete!
```

#### Statistics Tracking

```typescript
// Get current statistics
const stats = logger.getStats();
console.log(stats);
// Output:
// {
//   filesDiscovered: 106,
//   filesParsed: 106,
//   parseErrors: 0,
//   nodesCreated: 155,
//   edgesCreated: 306,
//   externalServicesDetected: 49,
//   startTime: Date,
//   endTime: Date,
//   duration: 179
// }

// Reset statistics
logger.resetStats();
```

#### Global Logger Instance

```typescript
import { getLogger, resetLogger } from './utils';

// Get or create global logger
const logger = getLogger();

// Reset global logger
resetLogger();
```

## CLI Integration

The CLI automatically uses the logging system to provide real-time feedback:

```bash
$ node dist/cli.js application --output /tmp/architecture.md

📋 Architecture Diagram Generator
─────────────────────────────────
  └─ Project root: /Users/user/project/application
  └─ Output file: /tmp/architecture.md
  └─ Max nodes: 150
  └─ Layer grouping: enabled
  └─ Mode: architecture

📋 File Discovery
─────────────────
  └─ Total files found: 106
  └─ Routes: 12
  └─ API endpoints: 24
  └─ Components: 41
  └─ Utilities: 29

📋 File Parsing
───────────────
  └─ Successfully parsed: 106 files
  └─ Duration: 130ms
  └─ Cache: 0 hits, 106 misses (0.0% hit rate)

📋 Dependency Graph
───────────────────
  └─ Nodes created: 155
  └─ Edges created: 306
  └─ External services detected: 49

📋 Diagram Generation
─────────────────────
  └─ Mode: architecture (filtered, 19 core nodes)
  └─ Nodes in diagram: 39
  └─ Edges in diagram: 46

📋 Output
─────────
  └─ Saved to: /tmp/architecture.md

📋 Summary
──────────
  └─ Files discovered: 106
  └─ Files parsed: 106
  └─ Nodes created: 155
  └─ Edges created: 306
  └─ External services: 49
  └─ Total duration: 179ms

✅ Generation complete!
```

## Error Handling in CLI

When an error occurs, the CLI provides detailed error information:

```bash
$ node dist/cli.js /nonexistent/path

❌ [INVALID_PROJECT_ROOT] Invalid project root: /nonexistent/path. Directory does not exist or is not accessible.

Stack trace:
InvalidProjectRootError: Invalid project root: /nonexistent/path. Directory does not exist or is not accessible.
    at main (/path/to/dist/cli.js:171:19)

💡 Troubleshooting:
   - Ensure the project root directory exists and is accessible
   - Check that the project contains TypeScript/JavaScript files
   - Verify file permissions for reading and writing
   - Use --help for usage information
```

## Best Practices

### 1. Use Specific Error Types

Always use the most specific error type for your situation:

```typescript
// Good
throw new FileReadError(filePath, error);

// Avoid
throw new Error(`Failed to read file: ${filePath}`);
```

### 2. Include Context Information

Provide relevant context when creating errors:

```typescript
// Good
throw new ParseError('src/app.ts', 'Unexpected token', lineNumber, columnNumber);

// Avoid
throw new ParseError('src/app.ts', 'Unexpected token');
```

### 3. Log Progress at Key Stages

Log progress at important milestones:

```typescript
logger.logDiscoveryProgress(...);
logger.logParsingProgress(...);
logger.logGraphProgress(...);
logger.logDiagramProgress(...);
logger.logOutputProgress(...);
logger.logSummary();
```

### 4. Handle Errors Gracefully

Catch errors and provide helpful messages:

```typescript
try {
  // operation
} catch (error) {
  if (error instanceof GeneratorError) {
    logger.error(error.getFormattedMessage());
  } else {
    logger.error(`Unexpected error: ${error}`);
  }
  process.exit(1);
}
```

### 5. Use Appropriate Log Levels

Choose the right log level for your message:

```typescript
logger.debug('Detailed information for debugging');
logger.info('General information about progress');
logger.warn('Warning about potential issues');
logger.error('Error messages');
logger.success('Success messages');
```

## Testing

The error handling and logging system includes comprehensive tests:

```bash
# Run error tests
npm test src/utils/errors.test.ts

# Run logger tests
npm test src/utils/logger.test.ts

# Run integration tests
npm test src/utils/integration.test.ts

# Run all tests
npm test
```

## Summary

The error handling and logging system provides:

✅ **Descriptive error messages** with context information
✅ **File paths and line numbers** in parse errors
✅ **Real-time progress logging** during file discovery and parsing
✅ **Summary statistics** showing files processed, nodes created, edges created, etc.
✅ **Comprehensive error types** for different failure scenarios
✅ **User-friendly CLI output** with clear formatting
✅ **Extensive test coverage** for reliability
