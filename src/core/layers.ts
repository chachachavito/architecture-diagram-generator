import { ArchitectureLayer } from './GraphTypes';

/**
 * The layers, outermost first. This ordering *is* the layering rule: a module
 * may depend inward, never outward.
 *
 * Runtime counterpart of the ArchitectureLayer type. A layer name outside this
 * list is skipped by layer-violation analysis, so configuration that invents
 * one silently disables the check for every module it labels.
 *
 * Kept out of GraphTypes.ts deliberately: that module exports only types, and
 * a single runtime value there would turn every one of its importers into a
 * runtime dependency.
 */
export const ARCHITECTURE_LAYERS: ArchitectureLayer[] = [
  'UI', 'API', 'Action', 'Service', 'Core', 'External',
];
