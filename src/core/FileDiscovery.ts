import { glob } from 'glob';
import path from 'path';
import fs from 'fs/promises';
import { InvalidProjectRootError } from '../utils/errors';

/**
 * Interface representing the configuration for file discovery
 */
export interface ProjectConfig {
  rootDir: string;
  include?: string[];
  exclude?: string[];
}

/**
 * Interface representing discovered files categorized by type
 */
export interface FileList {
  routes: string[];      // Arquivos de rota Next.js
  api: string[];         // Handlers de API
  components: string[];  // Componentes React
  utilities: string[];   // Utilitários e helpers
  config?: string[];     // Arquivos de configuração
}

/**
 * FileDiscovery class handles directory scanning and file categorization
 * for Next.js projects
 */
export class FileDiscovery {
  /**
   * Discovers files in the project and categorizes them by type
   * @param rootDir - Root directory of the project
   * @param config - Project configuration with include/exclude patterns
   * @returns Promise<FileList> - Categorized list of discovered files
   * @throws InvalidProjectRootError if the project root doesn't exist
   */
  async discover(rootDir: string, config: ProjectConfig): Promise<FileList> {
    // Verify project root exists
    try {
      await fs.access(rootDir);
    } catch {
      throw new InvalidProjectRootError(rootDir);
    }

    const fileList: FileList = {
      routes: [],
      api: [],
      components: [],
      utilities: [],
      config: [],
    };

    // Directories to scan
    const scanDirs = ['app', 'pages', 'api', 'src', 'components', 'services', 'utils', 'lib'];
    const defaultExclude = [
      '**/node_modules/**', 
      '**/.next/**', 
      '**/dist/**', 
      '**/build/**',
      '**/coverage/**',
      '**/.vercel/**',
      '**/.git/**',
      '**/*.test.*',
      '**/*.spec.*',
      '**/*.stories.*',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.test.js',
      '**/*.test.jsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/*.spec.js',
      '**/*.spec.jsx'
    ];
    const excludePatterns = [...defaultExclude, ...(config.exclude || [])];

    // Scan each directory
    for (const dir of scanDirs) {
      const fullPath = path.join(rootDir, dir);
      
      // Check if directory exists
      try {
        await fs.access(fullPath);
      } catch {
        // Directory doesn't exist, skip it
        continue;
      }

      // Get all files in the directory
      const pattern = path.join(dir, '**/*');
      const files = await glob(pattern, {
        cwd: rootDir,
        ignore: excludePatterns,
        absolute: false,
      });

      // Filter for TypeScript/JavaScript files
      const tsFiles = files.filter(f => /\.(ts|tsx|js|jsx)$/.test(f));

      // Categorize files
      for (const file of tsFiles) {
        const categorized = this.categorizeFile(file, dir);
        
        if (categorized !== null && fileList[categorized]) {
          fileList[categorized].push(file);
        }
      }
    }

    // Apply include patterns if specified
    if (config.include && config.include.length > 0) {
      fileList.routes = this.filter(fileList.routes, config.include);
      fileList.api = this.filter(fileList.api, config.include);
      fileList.components = this.filter(fileList.components, config.include);
      fileList.utilities = this.filter(fileList.utilities, config.include);
      if (fileList.config) {
        fileList.config = this.filter(fileList.config, config.include);
      }
    }

    return fileList;
  }

  /**
   * Filters files based on inclusion patterns
   * @param files - Array of file paths to filter
   * @param patterns - Array of glob patterns to match
   * @returns string[] - Filtered file paths
   */
  filter(files: string[], patterns: string[]): string[] {
    if (!patterns || patterns.length === 0) {
      return files;
    }

    return files.filter((file) => {
      return patterns.some((pattern) => {
        // Simple glob pattern matching
        const regex = this.globToRegex(pattern);
        return regex.test(file);
      });
    });
  }

  /**
   * Categorizes a file based on its path and location
   * @param filePath - Relative file path
   * @param baseDir - Base directory where file was found
   * @returns Category name or null if not categorized
   */
  private categorizeFile(
    filePath: string,
    baseDir: string
  ): keyof FileList | null {
    // API routes
    if (baseDir === 'app' && filePath.includes('api/')) {
      return 'api';
    }
    if (baseDir === 'api') {
      return 'api';
    }
    if (baseDir === 'pages' && filePath.includes('api/')) {
      return 'api';
    }

    // Page routes and layouts
    if (baseDir === 'app' && !filePath.includes('api/')) {
      if (filePath.endsWith('page.tsx') || filePath.endsWith('page.ts') ||
          filePath.endsWith('page.jsx') || filePath.endsWith('page.js') ||
          filePath.endsWith('layout.tsx') || filePath.endsWith('layout.ts') ||
          filePath.endsWith('layout.jsx') || filePath.endsWith('layout.js')) {
        return 'routes';
      }
    }
    if (baseDir === 'pages' && !filePath.includes('api/')) {
      return 'routes';
    }

    // Components
    if (filePath.includes('component') || filePath.includes('_component')) {
      return 'components';
    }
    if (baseDir === 'app' && !filePath.includes('api/')) {
      if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') ||
          filePath.endsWith('.jsx') || filePath.endsWith('.js')) {
        // Check if it's not a page or layout
        if (!filePath.endsWith('page.tsx') && !filePath.endsWith('layout.tsx') &&
            !filePath.endsWith('page.ts') && !filePath.endsWith('layout.ts') &&
            !filePath.endsWith('page.jsx') && !filePath.endsWith('layout.jsx') &&
            !filePath.endsWith('page.js') && !filePath.endsWith('layout.js')) {
          return 'components';
        }
      }
    }

    // Utilities and helpers (check before config to prioritize utils/helpers)
    if (filePath.includes('utils') || filePath.includes('helpers') || baseDir === 'utils') {
      return 'utilities';
    }

    // Services
    if (filePath.includes('services') || baseDir === 'services') {
      return 'utilities';
    }

    // Lib directory
    if (baseDir === 'lib') {
      return 'utilities';
    }

    // Components directory
    if (baseDir === 'components') {
      return 'components';
    }

    // Configuration files
    if (
      filePath.includes('config') ||
      filePath.includes('constants') ||
      filePath.endsWith('.config.ts') ||
      filePath.endsWith('.config.js')
    ) {
      return 'config';
    }

    // Default to utilities for src directory
    if (baseDir === 'src') {
      return 'utilities';
    }

    return null;
  }

  /**
   * Converts a glob pattern to a regular expression
   * @param pattern - Glob pattern string
   * @returns RegExp - Regular expression for matching
   */
  private globToRegex(pattern: string): RegExp {
    // Handle ** first (before escaping)
    let regexPattern = pattern;
    
    // Replace **/ with a special pattern that matches zero or more directories
    regexPattern = regexPattern.replace(/\*\*\//g, '___DOUBLESTAR_SLASH___');
    
    // Replace /** with a special pattern that matches zero or more directories
    regexPattern = regexPattern.replace(/\/\*\*/g, '___SLASH_DOUBLESTAR___');
    
    // Replace remaining ** with a placeholder
    regexPattern = regexPattern.replace(/\*\*/g, '___DOUBLESTAR___');
    
    // Replace single * with a placeholder (before escaping)
    regexPattern = regexPattern.replace(/\*/g, '___STAR___');
    
    // Replace ? with a placeholder (before escaping)
    regexPattern = regexPattern.replace(/\?/g, '___QUESTION___');
    
    // Escape special regex characters
    regexPattern = regexPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    
    // Replace the placeholders back with proper regex
    regexPattern = regexPattern.replace(/___DOUBLESTAR_SLASH___/g, '(?:.*/)?');
    regexPattern = regexPattern.replace(/___SLASH_DOUBLESTAR___/g, '(?:/.*)?');
    regexPattern = regexPattern.replace(/___DOUBLESTAR___/g, '.*');
    regexPattern = regexPattern.replace(/___STAR___/g, '[^/]*');
    regexPattern = regexPattern.replace(/___QUESTION___/g, '[^/]');

    // Anchor the pattern
    return new RegExp(`^${regexPattern}$`);
  }
}
