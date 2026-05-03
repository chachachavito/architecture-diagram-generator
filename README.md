# 🧠 Architecture Analysis Platform (v0.5.0)

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

Create `architecture-analyzer.json`:

```json
{
  "preset": "balanced",
  "rules": {
    "fan-out": { "threshold": 12 },
    "fan-in": { "threshold": 20 },
    "layer-violation": "error"
  }
}
```

### Presets

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
