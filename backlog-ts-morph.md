# Backlog: ts-morph Integration & Schema Enrichment

## Goal
- **Target Version**: `0.3.0`
- **Objective**: Replace raw TypeScript Compiler API with `ts-morph` to enable semantic analysis and enriched architectural metadata.

## Phase 1: Infrastructure & Setup (Performance Optimized)
- [x] Install `ts-morph` and its dependencies in `architecture-diagram-generator`.
- [x] Implement `Project` Singleton logic in `ASTParser` to reuse the TypeScript program.
- [x] Implement `tsconfig.json` resolution with graceful fallback for projects without it.
- [x] Update `ModuleCache` logic to handle engine migration (cache invalidation).

## Phase 2: Core Refactor (Semantic Analysis)
- [x] Refactor `extractImports` & `extractExports` using `ts-morph` API.
- [x] Implement detection of Type-only imports vs. Runtime imports.
- [x] Refactor `detectExternalCalls` to use the `TypeChecker` for high-precision identification (Prisma, Axios, etc.).

## Phase 3: Metadata Enrichment (Enriched Graph)
- [x] Implement inheritance extraction (`extends`/`implements`) to map class hierarchies.
- [x] Implement Decorator extraction (e.g., `@Injectable`, `@Controller`) for automated classification.
- [x] Implement SLOC and Cyclomatic Complexity metrics per module.
- [x] Add `typeOnly` flag to dependency edges in the JSON graph.

## Phase 4: Contract Alignment & Documentation
- [x] Document the new `architecture.json` schema (v0.3.0) with the new metadata fields.
- [x] Define the impact of `inheritance` and `typeOnly` on existing stability and coupling metrics.
- [x] Create a "Contract Change" report to guide the `architecture-analyzer` update.

## Phase 5: Architecture Analyzer Update
- [x] Update types/interfaces in `architecture-analyzer` to match the new schema.
- [x] Implement inheritance-based rules (e.g., "Domain should not extend Infrastructure").
- [x] Update circular dependency detection to optionally ignore `type-only` imports.
- [x] Implement complexity-based linting rules.


## Phase 6: Validation & Quality
- [x] Migrate existing integration tests to verify parser parity/accuracy.
- [x] Benchmark performance (Memory usage and Parse time) comparison.
- [x] Update documentation with the new metadata specification.
