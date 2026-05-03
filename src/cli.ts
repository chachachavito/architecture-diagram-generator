#!/usr/bin/env node
import { Command } from 'commander';
import { ArchitecturePipeline } from './core/ArchitecturePipeline';
import { AnalysisHistory } from './analyzer/AnalysisHistory';
import { getPreset, PRESET_NAMES } from './analyzer/presets';
import type { AnalyzerConfig } from './analyzer/AnalyzerConfig';
import * as path from 'path';

const VERSION = '1.3.0';

// ── Environment Detection ────────────────────────────────────────────────────
const isCI = !!(process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI || process.env.JENKINS_URL || process.env.CIRCLECI);

// ── ANSI Colors ──────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
};

const SEVERITY_ICONS: Record<string, string> = {
  critical: '🔴', high: '🟠', medium: '🟡', low: '🔵',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: C.red, high: C.red, medium: C.yellow, low: C.gray,
};

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 4, high: 3, medium: 2, low: 1,
};

function resolveFormat(explicit?: string, jsonFlag?: boolean): string {
  if (jsonFlag) return 'json';
  if (explicit) return explicit;
  return isCI ? 'compact' : 'pretty';
}

function resolvePresetConfig(presetName?: string): AnalyzerConfig | undefined {
  if (!presetName) return undefined;
  const preset = getPreset(presetName);
  if (!preset) {
    console.error(`Unknown preset: ${presetName}. Available: ${PRESET_NAMES.join(', ')}`);
    process.exit(1);
  }
  return preset;
}

async function main() {
  const program = new Command();

  program
    .name('architecture-generator')
    .description('Architecture Analysis & Visualization Platform')
    .version(VERSION, '-v, --version', 'output the current version');

  // ── Default command: generate ────────────────────────────────────────────
  program
    .argument('[project-root]', 'Root directory of the project to analyze', '.')
    .option('-o, --output <path>', 'Path to save the generated JSON', 'architecture.json')
    .option('-d, --debug', 'Output detailed debug logs', false)
    .option('-f, --format <format>', 'Output format (json, html, svg)', 'json')
    .option('--preset <name>', `Rule preset: ${PRESET_NAMES.join(' | ')}`)
    .action(async (projectRoot, options) => {
      try {
        const absProjectRoot = path.resolve(projectRoot);
        const analyzerConfig = resolvePresetConfig(options.preset);

        const pipeline = new ArchitecturePipeline({
          version: VERSION,
          config: {},
          debug: options.debug,
          rootDir: absProjectRoot,
          outputBase: options.output,
          analyzerConfig,
        });

        console.log(`Analyzing project at: ${absProjectRoot}`);
        const result = await pipeline.runFull(absProjectRoot);

        if (result.analysis) {
          const a = result.analysis;
          console.log(`\nArchitecture Score: ${a.score}/100`);
          if (a.summary.totalIssues > 0) {
            console.log(`Issues: ${a.summary.totalIssues} (${a.summary.criticalIssues} critical)`);
          }
          await printTrend(absProjectRoot, a.score);
        }

        console.log(`\nGeneration successful!`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // ── analyze command ──────────────────────────────────────────────────────
  program
    .command('analyze')
    .description('Run architecture analysis and print detailed report')
    .argument('[project-root]', 'Root directory', '.')
    .option('-d, --debug', 'Debug mode', false)
    .option('--json', 'Output as JSON', false)
    .option('--report-format <fmt>', 'Output format: pretty | json | compact', undefined)
    .option('--preset <name>', `Rule preset: ${PRESET_NAMES.join(' | ')}`)
    .option('--changed', 'Analyze only git-changed files', false)
    .action(async (projectRoot, options) => {
      try {
        const absProjectRoot = path.resolve(projectRoot);
        const analyzerConfig = resolvePresetConfig(options.preset);
        const pipeline = new ArchitecturePipeline({
          version: VERSION,
          config: {},
          debug: options.debug,
          rootDir: absProjectRoot,
          analyzerConfig,
          changedOnly: options.changed,
        });

        const result = await pipeline.runFull(absProjectRoot);
        const analysis = result.analysis;

        if (!analysis) {
          console.error('Analysis failed.');
          process.exit(1);
        }

        const fmt = resolveFormat(options.reportFormat, options.json);

        if (fmt === 'json') {
          console.log(JSON.stringify(analysis, null, 2));
          return;
        }

        if (fmt === 'compact') {
          printCompact(analysis);
          return;
        }

        // Pretty format (default)
        printPretty(analysis);
        await printTrend(absProjectRoot, analysis.score);
        printExitSummary(analysis);

      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // ── check command (CI gate) ──────────────────────────────────────────────
  program
    .command('check')
    .description('CI quality gate — fails if architecture violates constraints')
    .argument('[project-root]', 'Root directory', '.')
    .option('-t, --threshold <score>', 'Minimum acceptable score', '70')
    .option('--fail-on <severity>', 'Fail if any issue of this severity or higher exists (critical|high|medium|low)')
    .option('--max-issues <count>', 'Fail if total issues exceed this count')
    .option('--report-format <fmt>', 'Output format: pretty | json | compact', undefined)
    .option('--preset <name>', `Rule preset: ${PRESET_NAMES.join(' | ')}`)
    .option('--changed', 'Analyze only git-changed files', false)
    .option('-d, --debug', 'Debug mode', false)
    .action(async (projectRoot, options) => {
      try {
        const absProjectRoot = path.resolve(projectRoot);
        const threshold = parseInt(options.threshold, 10);
        const analyzerConfig = resolvePresetConfig(options.preset);

        const pipeline = new ArchitecturePipeline({
          version: VERSION,
          config: {},
          debug: options.debug,
          rootDir: absProjectRoot,
          analyzerConfig,
          changedOnly: options.changed,
        });

        const result = await pipeline.runFull(absProjectRoot);
        const analysis = result.analysis;

        if (!analysis) {
          console.error('Analysis failed.');
          process.exit(1);
        }

        const fmt = resolveFormat(options.reportFormat);

        if (fmt === 'json') {
          const failures = evaluateGates(analysis, threshold, options.failOn, options.maxIssues);
          const checkResult = { passed: failures.length === 0, score: analysis.score, threshold, issues: analysis.issues.length, failures };
          console.log(JSON.stringify(checkResult, null, 2));
          if (!checkResult.passed) process.exit(1);
          return;
        }

        if (fmt === 'compact') {
          const failures = evaluateGates(analysis, threshold, options.failOn, options.maxIssues);
          const status = failures.length === 0 ? 'PASSED' : 'FAILED';
          console.log(`${status} score=${analysis.score} threshold=${threshold} issues=${analysis.issues.length} failures=${failures.length}`);
          if (failures.length > 0) {
            failures.forEach(f => console.log(`  FAIL: ${f}`));
            process.exit(1);
          }
          return;
        }

        // Pretty
        const failures = evaluateGates(analysis, threshold, options.failOn, options.maxIssues);

        if (failures.length === 0) {
          console.log(`\n✅ 🚀 Architecture Score: ${C.green}${analysis.score}/100${C.reset} (threshold: ${threshold})`);
          console.log(`   Passed with ${analysis.summary.totalIssues} issues.`);
          await printTrend(absProjectRoot, analysis.score);
          console.log('\nPASSED\n');
        } else {
          console.error(`\n❌ Architecture Score: ${C.red}${analysis.score}/100${C.reset} (threshold: ${threshold})`);
          for (const f of failures) {
            console.error(`   ${C.red}✗${C.reset} ${f}`);
          }
          console.error(`\nFAILED\n`);
          process.exit(1);
        }

      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // ── diff command ──────────────────────────────────────────────────────────
  program
    .command('diff')
    .description('Compare current analysis against the previous snapshot')
    .argument('[project-root]', 'Root directory', '.')
    .option('-d, --debug', 'Debug mode', false)
    .option('--json', 'Output as JSON', false)
    .option('--preset <name>', `Rule preset: ${PRESET_NAMES.join(' | ')}`)
    .action(async (projectRoot, options) => {
      try {
        const absProjectRoot = path.resolve(projectRoot);
        const analyzerConfig = resolvePresetConfig(options.preset);
        const pipeline = new ArchitecturePipeline({
          version: VERSION,
          config: {},
          debug: options.debug,
          rootDir: absProjectRoot,
          analyzerConfig,
        });

        const result = await pipeline.runFull(absProjectRoot);
        const analysis = result.analysis;

        if (!analysis) {
          console.error('Analysis failed.');
          process.exit(1);
        }

        const history = new AnalysisHistory(absProjectRoot);
        const diffResult = await history.diff(analysis);

        if (!diffResult) {
          console.log('\nNo previous snapshot found. Run analyze first to create a baseline.\n');
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(diffResult, null, 2));
          return;
        }

        // Pretty diff output
        const trendIcon = diffResult.trend === 'improved' ? '📈' : diffResult.trend === 'regressed' ? '📉' : '➡️';
        const deltaColor = diffResult.scoreDelta > 0 ? C.green : diffResult.scoreDelta < 0 ? C.red : C.gray;
        const deltaSign = diffResult.scoreDelta > 0 ? '+' : '';

        console.log(`\n${C.bright}Architecture Diff${C.reset}`);
        console.log(`─────────────────────────────────────`);
        console.log(`  ${trendIcon} Trend: ${C.bright}${diffResult.trend.toUpperCase()}${C.reset}`);
        console.log(`  Score: ${diffResult.previous.score} → ${diffResult.current.score} (${deltaColor}${deltaSign}${diffResult.scoreDelta}${C.reset})`);
        console.log(`  Issues: ${diffResult.previous.totalIssues} → ${diffResult.current.totalIssues}`);
        console.log(`  Modules: ${diffResult.previous.totalNodes} → ${diffResult.current.totalNodes}`);
        console.log('');

        if (diffResult.newIssues.length > 0) {
          console.log(`  ${C.red}${C.bright}New Issues (${diffResult.newIssues.length}):${C.reset}`);
          for (const issue of diffResult.newIssues) {
            const icon = SEVERITY_ICONS[issue.severity] || '⚪';
            console.log(`    ${icon} [${issue.severity.toUpperCase()}] ${issue.message}`);
          }
          console.log('');
        }

        if (diffResult.resolvedIssues.length > 0) {
          console.log(`  ${C.green}${C.bright}Resolved Issues (${diffResult.resolvedIssues.length}):${C.reset}`);
          for (const issue of diffResult.resolvedIssues) {
            console.log(`    ✅ ${issue.message}`);
          }
          console.log('');
        }

        if (diffResult.newIssues.length === 0 && diffResult.resolvedIssues.length === 0) {
          console.log(`  ${C.dim}No changes in issues since last run.${C.reset}\n`);
        }

      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // ── init command ──────────────────────────────────────────────────────────
  program
    .command('init')
    .description('Create a default architecture-analyzer.json config file')
    .option('--preset <name>', `Base preset: ${PRESET_NAMES.join(' | ')}`, 'balanced')
    .action(async (options) => {
      const fs = await import('fs/promises');
      const preset = getPreset(options.preset);
      if (!preset) {
        console.error(`Unknown preset: ${options.preset}`);
        process.exit(1);
      }

      const configPath = path.join(process.cwd(), 'architecture-analyzer.json');
      try {
        await fs.access(configPath);
        console.log('Config file already exists: architecture-analyzer.json');
        return;
      } catch {
        // File doesn't exist, create it
      }

      await fs.writeFile(configPath, JSON.stringify(preset, null, 2) + '\n');
      console.log(`✅ Created architecture-analyzer.json (preset: ${options.preset})`);
    });

  await program.parseAsync(process.argv);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface AnalysisLike {
  score: number;
  issues: { severity: string; nodeId: string; message: string; ruleId: string; suggestion?: string; metadata?: Record<string, any> }[];
  metrics: { totalNodes: number; totalEdges: number; avgFanIn: number; avgFanOut: number };
  summary: { totalIssues: number; criticalIssues: number; highIssues: number; layerViolations: number; cycles: number };
}

function evaluateGates(
  analysis: AnalysisLike,
  threshold: number,
  failOnSeverity?: string,
  maxIssues?: string,
): string[] {
  const failures: string[] = [];

  if (analysis.score < threshold) {
    failures.push(`Score ${analysis.score} is below threshold ${threshold}`);
  }

  if (failOnSeverity) {
    const minWeight = SEVERITY_WEIGHT[failOnSeverity] || 0;
    const blocking = analysis.issues.filter(i => (SEVERITY_WEIGHT[i.severity] || 0) >= minWeight);
    if (blocking.length > 0) {
      failures.push(`${blocking.length} issue(s) with severity >= ${failOnSeverity}`);
    }
  }

  if (maxIssues !== undefined) {
    const max = parseInt(maxIssues, 10);
    if (analysis.issues.length > max) {
      failures.push(`${analysis.issues.length} issues exceeds max-issues limit of ${max}`);
    }
  }

  return failures;
}

async function printTrend(projectRoot: string, currentScore: number): Promise<void> {
  try {
    const history = new AnalysisHistory(projectRoot);
    const entries = await history.list();
    // Need at least 2 entries (current + previous)
    if (entries.length < 2) return;
    
    const previous = entries[1]; // [0] is the current run just saved
    const delta = currentScore - previous.score;
    if (delta === 0) return;
    
    const icon = delta > 0 ? '📈' : '📉';
    const color = delta > 0 ? C.green : C.red;
    const sign = delta > 0 ? '+' : '';
    console.log(`${icon} ${color}${sign}${delta}${C.reset} since last run (${previous.score} → ${currentScore})`);
  } catch {
    // History not available, skip trend
  }
}

function printExitSummary(analysis: AnalysisLike): void {
  if (analysis.summary.criticalIssues > 0) {
    console.log(`${C.red}${C.bright}❌ ${analysis.summary.criticalIssues} critical issue(s) require immediate attention${C.reset}\n`);
  } else if (analysis.summary.totalIssues > 0) {
    console.log(`${C.yellow}⚠ ${analysis.summary.totalIssues} issue(s) detected — review recommended${C.reset}\n`);
  } else {
    console.log(`${C.green}✔ Architecture healthy — no issues detected${C.reset}\n`);
  }
}

function printPretty(analysis: AnalysisLike): void {
  console.log(`\n${C.bright}╔══════════════════════════════════════╗${C.reset}`);
  const scoreColor = analysis.score >= 80 ? C.bgGreen : (analysis.score >= 50 ? C.yellow : C.red);
  console.log(`${C.bright}║  Architecture Score: ${scoreColor} ${String(analysis.score).padStart(3)}/100 ${C.reset}${C.bright}        ║${C.reset}`);
  console.log(`${C.bright}╚══════════════════════════════════════╝${C.reset}\n`);

  if (analysis.issues.length === 0) {
    console.log('✅ No issues found. Your architecture is clean!\n');
  } else {
    console.log(`⚠️  ${C.bright}Issues (${analysis.issues.length}):${C.reset}\n`);

    const sortedIssues = [...analysis.issues].sort((a, b) =>
      (SEVERITY_WEIGHT[b.severity] || 0) - (SEVERITY_WEIGHT[a.severity] || 0)
    );

    for (const issue of sortedIssues) {
      const color = SEVERITY_COLORS[issue.severity] || C.reset;
      const icon = SEVERITY_ICONS[issue.severity] || '⚪';

      console.log(`  ${icon} [${color}${issue.severity.toUpperCase()}${C.reset}] ${C.bright}${issue.message}${C.reset}`);

      if (issue.metadata && issue.metadata.value !== undefined) {
        console.log(`     ${C.dim}→ ${issue.metadata.value} (threshold: ${issue.metadata.threshold})${C.reset}`);
      }

      if (issue.suggestion) {
        console.log(`     ${C.cyan}💡 ${issue.suggestion}${C.reset}`);
      }
      console.log('');
    }
  }

  // Top problematic modules
  const issueCountByNode: Record<string, number> = {};
  for (const issue of analysis.issues) {
    issueCountByNode[issue.nodeId] = (issueCountByNode[issue.nodeId] || 0) + 1;
  }

  const topProblematic = Object.entries(issueCountByNode)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (topProblematic.length > 0) {
    console.log(`🔥 ${C.bright}Top problematic modules:${C.reset}`);
    topProblematic.forEach(([nodeId, count], i) => {
      const name = nodeId.split('/').pop() || nodeId;
      console.log(`  ${i + 1}. ${C.red}${name}${C.reset} (${count} issues)`);
    });
    console.log('');
  }

  // Summary
  console.log(`📊 ${C.bright}Summary:${C.reset}`);
  console.log(`  - Modules:             ${analysis.metrics.totalNodes}`);
  console.log(`  - Dependencies:        ${analysis.metrics.totalEdges}`);
  console.log(`  - Circular deps:       ${analysis.summary.cycles > 0 ? C.red : C.reset}${analysis.summary.cycles}${C.reset}`);
  console.log(`  - Layer violations:    ${analysis.summary.layerViolations > 0 ? C.red : C.reset}${analysis.summary.layerViolations}${C.reset}`);
  console.log(`  - Avg Fan-Out:         ${analysis.metrics.avgFanOut}`);
  console.log(`  - Avg Fan-In:          ${analysis.metrics.avgFanIn}`);
  console.log('');
}

function printCompact(analysis: AnalysisLike): void {
  console.log(`score=${analysis.score} issues=${analysis.issues.length} critical=${analysis.summary.criticalIssues} high=${analysis.summary.highIssues} cycles=${analysis.summary.cycles} violations=${analysis.summary.layerViolations}`);
  for (const issue of analysis.issues) {
    console.log(`${issue.severity}\t${issue.ruleId}\t${issue.nodeId.split('/').pop()}\t${issue.message}`);
  }
}

main();
