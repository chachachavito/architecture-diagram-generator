import * as fs from 'fs/promises';
import * as path from 'path';
import { AnalysisResult } from './types';

export interface HistoryEntry {
  timestamp: string;
  score: number;
  totalIssues: number;
  criticalIssues: number;
  highIssues: number;
  layerViolations: number;
  cycles: number;
  totalNodes: number;
  totalEdges: number;
  issues: { ruleId: string; nodeId: string; severity: string; message: string }[];
}

export interface HistoryDiff {
  previous: HistoryEntry;
  current: HistoryEntry;
  scoreDelta: number;
  newIssues: { ruleId: string; nodeId: string; severity: string; message: string }[];
  resolvedIssues: { ruleId: string; nodeId: string; severity: string; message: string }[];
  trend: 'improved' | 'regressed' | 'stable';
}

/**
 * Manages architecture analysis history for tracking evolution.
 */
export class AnalysisHistory {
  constructor(
    private rootDir: string,
    private historyDir: string = '.architecture/history',
    private maxEntries: number = 30,
  ) {}

  private get absDir(): string {
    return path.isAbsolute(this.historyDir)
      ? this.historyDir
      : path.join(this.rootDir, this.historyDir);
  }

  /**
   * Save a snapshot of the current analysis.
   */
  async save(analysis: AnalysisResult): Promise<string> {
    await fs.mkdir(this.absDir, { recursive: true });

    const timestamp = new Date().toISOString();
    const entry: HistoryEntry = {
      timestamp,
      score: analysis.score,
      totalIssues: analysis.summary.totalIssues,
      criticalIssues: analysis.summary.criticalIssues,
      highIssues: analysis.summary.highIssues,
      layerViolations: analysis.summary.layerViolations,
      cycles: analysis.summary.cycles,
      totalNodes: analysis.metrics.totalNodes,
      totalEdges: analysis.metrics.totalEdges,
      issues: analysis.issues.map(i => ({
        ruleId: i.ruleId,
        nodeId: i.nodeId,
        severity: i.severity,
        message: i.message,
      })),
    };

    const filename = `${timestamp.replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(this.absDir, filename);
    await fs.writeFile(filepath, JSON.stringify(entry, null, 2));

    // Prune old entries
    await this.prune();

    return filepath;
  }

  /**
   * List all history entries sorted by timestamp (newest first).
   */
  async list(): Promise<HistoryEntry[]> {
    try {
      const files = await fs.readdir(this.absDir);
      const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse();

      const entries: HistoryEntry[] = [];
      for (const file of jsonFiles) {
        const content = await fs.readFile(path.join(this.absDir, file), 'utf-8');
        entries.push(JSON.parse(content));
      }
      return entries;
    } catch {
      return [];
    }
  }

  /**
   * Get the most recent entry.
   */
  async latest(): Promise<HistoryEntry | null> {
    const entries = await this.list();
    return entries[0] || null;
  }

  /**
   * Diff current analysis against the previous snapshot.
   */
  async diff(current: AnalysisResult): Promise<HistoryDiff | null> {
    const previous = await this.latest();
    if (!previous) return null;

    const currentEntry: HistoryEntry = {
      timestamp: new Date().toISOString(),
      score: current.score,
      totalIssues: current.summary.totalIssues,
      criticalIssues: current.summary.criticalIssues,
      highIssues: current.summary.highIssues,
      layerViolations: current.summary.layerViolations,
      cycles: current.summary.cycles,
      totalNodes: current.metrics.totalNodes,
      totalEdges: current.metrics.totalEdges,
      issues: current.issues.map(i => ({
        ruleId: i.ruleId,
        nodeId: i.nodeId,
        severity: i.severity,
        message: i.message,
      })),
    };

    const prevKeys = new Set(previous.issues.map(i => `${i.ruleId}::${i.nodeId}`));
    const currKeys = new Set(currentEntry.issues.map(i => `${i.ruleId}::${i.nodeId}`));

    const newIssues = currentEntry.issues.filter(i => !prevKeys.has(`${i.ruleId}::${i.nodeId}`));
    const resolvedIssues = previous.issues.filter(i => !currKeys.has(`${i.ruleId}::${i.nodeId}`));

    const scoreDelta = currentEntry.score - previous.score;
    const trend = scoreDelta > 0 ? 'improved' : scoreDelta < 0 ? 'regressed' : 'stable';

    return {
      previous,
      current: currentEntry,
      scoreDelta,
      newIssues,
      resolvedIssues,
      trend,
    };
  }

  private async prune(): Promise<void> {
    try {
      const files = await fs.readdir(this.absDir);
      const jsonFiles = files.filter(f => f.endsWith('.json')).sort();
      if (jsonFiles.length <= this.maxEntries) return;

      const toDelete = jsonFiles.slice(0, jsonFiles.length - this.maxEntries);
      for (const file of toDelete) {
        await fs.unlink(path.join(this.absDir, file));
      }
    } catch {
      // Ignore prune errors
    }
  }
}
