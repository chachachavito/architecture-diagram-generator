# Architecture Contract Specification v0.3.0

This document defines the changes in the `architecture.json` output format and the expected impact on architectural analysis.

## Versioning
- **Engine**: `ts-morph` (Semantic Analysis)
- **JSON Version**: `0.3.0`

## 1. Dependency Graph Changes

### Edges (GraphEdge)
Edges now distinguish between runtime dependencies and type-only dependencies.

| Field | Type | Description |
| :--- | :--- | :--- |
| `isTypeOnly` | `boolean` | `true` if the import is used only for TypeScript types. |

**Impact on Metrics**:
- **Instability ($I$)**: Should be calculated optionally excluding `isTypeOnly: true` edges to reflect real runtime coupling.
- **Circular Dependencies**: Cycles consisting only of type imports might be downgraded in severity.

## 2. Module Metadata Changes (NodeMetadata)

Enriched metadata extracted via semantic analysis.

### Inheritance
Mapped via `inheritance` field.
- **Structure**: `Array<{ name: string, type: 'extends' | 'implements' }>`
- **Analysis**: Allows enforcing inheritance rules (e.g., "Entities should not implement Infrastructure interfaces").

### Metrics
Quantitative data for hotspot detection.
- **Complexity**: Cyclomatic complexity based on decision points (if, loops, cases, logic operators).
- **SLOC**: Source Lines of Code (excluding empty lines).

### Decorators
Captures framework-level metadata.
- **Structure**: `Array<string>`
- **Analysis**: Enables automated classification of modules into layers (UI, API, Service) based on decorators like `@Controller`, `@Injectable`, or `@Entity`.

## 3. Implementation Checklist for `architecture-analyzer`
1. Update `SourceGraph` and `GraphNode` interfaces.
2. Update `Instability` calculation logic to accept a `filterTypeOnly` parameter.
3. Implement `InheritanceRule` validator.
4. Implement `ComplexityThresholdRule` validator.
