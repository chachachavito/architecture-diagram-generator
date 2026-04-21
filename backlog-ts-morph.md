# Backlog: ts-morph Integration & Schema Enrichment

## Goal
- **Target Version**: `0.3.0`
- **Objective**: Replace raw TypeScript Compiler API with `ts-morph` to enable semantic analysis and enriched architectural metadata.

## Phase 1: Infrastructure & Setup (Performance Optimized)
- [ ] Install `ts-morph` and its dependencies in `architecture-diagram-generator`.
- [ ] Implement `Project` Singleton logic in `ASTParser` to reuse the TypeScript program.
- [ ] Implement `tsconfig.json` resolution with graceful fallback for projects without it.
- [ ] Update `ModuleCache` logic to handle engine migration (cache invalidation).

## Phase 2: Core Refactor (Semantic Analysis)
- [ ] Refactor `extractImports` & `extractExports` using `ts-morph` API.
- [ ] Implement detection of Type-only imports vs. Runtime imports.
- [ ] Refactor `detectExternalCalls` to use the `TypeChecker` for high-precision identification (Prisma, Axios, etc.).

## Phase 3: Metadata Enrichment (Enriched Graph)
- [ ] Implement inheritance extraction (`extends`/`implements`) to map class hierarchies.
- [ ] Implement Decorator extraction (e.g., `@Injectable`, `@Controller`) for automated classification.
- [ ] Implement SLOC and Cyclomatic Complexity metrics per module.
- [ ] Add `typeOnly` flag to dependency edges in the JSON graph.

## Phase 4: Schema & Contract Update
- [ ] Update `architecture.json` schema to include the new metadata fields.
- [ ] Define a strict shared interface for the JSON contract to avoid drift between Generator and Analyzer.

## Phase 5: Architecture Analyzer Update
- [ ] Update types/interfaces in `architecture-analyzer` to match the new schema.
- [ ] Implement inheritance-based rules (e.g., "Domain should not extend Infrastructure").
- [ ] Update circular dependency detection to optionally ignore `type-only` imports.
- [ ] Implement complexity-based linting rules.

## Phase 6: Validation & Quality
- [ ] Migrate existing integration tests to verify parser parity/accuracy.
- [ ] Benchmark performance (Memory usage and Parse time) comparison.
- [ ] Update documentation with the new metadata specification.
