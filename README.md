# 🧠 Architecture Analysis Platform

> Stop guessing your architecture. Start measuring it.

Transform your codebase into actionable architectural insights with scoring, rules, CI enforcement, and interactive visualization.

---

## 🚀 What is this?

This tool analyzes your codebase using static analysis and generates:

- 📊 **Architecture Score (0–100)**
- ⚠️ **Actionable Issues** (with explanations & fixes)
- 🔁 **History & Diff** (track evolution over time)
- 🧪 **CI/CD Enforcement** (prevent regressions)
- 🧭 **Interactive Dashboard** (visual + diagnostic)

---

## ⚡ Quick Start (30 seconds)

```bash
npx architecture-generator .
```

---

## 🧪 Analyze your architecture

```bash
architecture-generator analyze .
```

Example output:

```txt
Architecture Score: 85/100

⚠️ Issues (5):

[MEDIUM] High fan-out in src/core/ArchitecturePipeline.ts
→ 14 dependencies (limit: 10)
→ Suggestion: Split responsibilities or extract services

📊 Summary:
- Circular dependencies: 0 ✅
- Layer violations: 0 ✅
- Avg fan-out: 8.2
```

---

## 🛡️ Use in CI/CD (prevent bad architecture)

```bash
architecture-generator check . -t 80 --fail-on high
```

- Fails build if architecture score drops
- Blocks critical violations
- Keeps your architecture healthy over time

---

## 🔍 Track architecture evolution

```bash
architecture-generator diff .
```

Example:

```txt
Score: 82 → 85 (+3)

+2 new issues
-4 resolved issues

Trend: improving 📈
```

---

## ⚙️ Configuration

There are two config files, with different jobs. Both are optional, both are
auto-detected in the project root, and neither is required to get a first run.

| File | Controls |
| --- | --- |
| `architecture-config.json` | **What goes into the graph** — which files are scanned, and how modules map to layers and domains |
| `architecture-analyzer.json` | **How the graph is judged** — which rules run, at what severity and thresholds |

### `architecture-config.json` — what gets analyzed

```json
{
  "include": ["app/**", "lib/**", "components/**", "middleware.ts"],
  "exclude": ["**/*.test.ts", "**/node_modules/**"],
  "layers": [
    { "name": "UI",   "patterns": ["**/app/**/page.tsx", "**/components/**"] },
    { "name": "API",  "patterns": ["**/app/api/**", "**/middleware.ts"] },
    { "name": "Core", "patterns": ["**/lib/**", "**/services/**"] }
  ],
  "domains": [
    { "name": "AccessControl", "patterns": ["**/auth/**", "**/middleware.ts"] }
  ]
}
```

Point at a different file with `--config`:

```bash
architecture-generator analyze . --config ./config/architecture.json
```

> **Root-level files must be named in `include`.** By default the scanner walks
> `app/`, `pages/`, `api/`, `src/`, `lib/`, `components/`, `services/` and
> `utils/`. A file that sits at the project root — Next.js `middleware.ts`, or
> `proxy.ts` on Next 16 — is only picked up if an `include` pattern names it.
> This matters: those files usually hold access control and redirects, so
> leaving them out means scoring an architecture without its request gate.

When no config file exists, discovery runs unfiltered over the directories
above. Adding a config file with an `include` list makes that list authoritative.

### `architecture-analyzer.json` — how it is scored

```json
{
  "rules": {
    "layer-violation":     { "enabled": true, "severity": "high" },
    "circular-dependency": { "enabled": true, "severity": "critical" },
    "high-fan-out":        { "enabled": true, "severity": "medium", "thresholds": { "maxFanOut": 12 } },
    "high-fan-in":         { "enabled": true, "severity": "medium", "thresholds": { "maxFanIn": 20 } },
    "god-module":          { "enabled": true, "severity": "high" }
  },
  "history": { "enabled": true, "maxEntries": 30 }
}
```

Rule ids are exactly: `layer-violation`, `circular-dependency`, `high-fan-out`,
`high-fan-in`, `god-module`. The schema is strict — an unknown key makes the
whole file invalid, and the run warns and falls back to default rules.

Generate one from a preset:

```bash
architecture-generator init --preset balanced
```

### Presets

Presets are selected per-run with `--preset`, not inside the config file:

```bash
architecture-generator check . --preset strict
```

- `strict` → zero tolerance (recommended for mature systems)
- `balanced` → default
- `relaxed` → good for legacy codebases

---

## 🧠 What it detects

- ❌ Circular dependencies  
- ❌ Layer violations  
- ⚠️ High coupling (fan-in / fan-out)  
- ⚠️ God modules  
- 📦 External service usage  
- 🧬 Type vs runtime dependencies  

---

## 📊 Interactive Dashboard

Generate a full visual report:

```bash
architecture-generator . -o architecture.json
```

Includes:

- Architecture graph (SVG)
- Issues explorer panel
- Click-to-inspect modules
- Suggestions & explanations

---

## 🔗 Pairing with `architecture-analyzer`

The JSON written by `-o` is consumed by `architecture-analyzer` directly. **No
adapter or shim is needed** — writing one that unwraps `.graph` yourself is a
common source of false positives.

```bash
architecture-generator . -o architecture.json
architecture-analyzer analyze architecture.json --baseline baseline.json
```

The emitted file has this shape, and the analyzer reads either the wrapper or a
bare graph:

```json
{
  "version": "0.6.0",
  "generatedAt": "2026-01-01T00:00:00.000Z",
  "graph": { "nodes": [], "edges": [] },
  "analysis": { "score": 100, "issues": [], "metrics": {}, "summary": {} }
}
```

---

## 🧩 Example Use Cases

- 🧪 Audit legacy codebases  
- 🛡️ Prevent architectural regressions in CI  
- 📈 Track architecture health over time  
- 🧠 Understand complex systems faster  
- 👥 Align teams on architecture decisions  

---

## 🔌 Programmatic API

```ts
import { ArchitecturePipeline } from 'architecture-diagram-generator';

const pipeline = new ArchitecturePipeline({
  rootDir: process.cwd()
});

const result = await pipeline.runFull('.');

console.log(result.analysis.score);
```

---

## 🛠️ Workflow Integration

### Pre-commit (Husky)

```bash
architecture-generator check . -t 70
```

---

## 📈 Why this matters

Architecture degrades silently over time.

This tool makes it:

- **visible**
- **measurable**
- **enforceable**

---

## 🧪 Real-world workflow

1. Run analysis  
2. Fix top issues  
3. Commit with CI check  
4. Track improvements over time  

---

## 💬 Feedback

This project is evolving fast.

If you:
- find false positives  
- want new rules  
- use it in production  

👉 open an issue or share your report

---

## 📦 Roadmap

- [ ] PR comment bot  
- [ ] Team dashboard (hosted)  
- [ ] Advanced rule engine  
- [ ] Monorepo insights  

---

## 📄 License

MIT
