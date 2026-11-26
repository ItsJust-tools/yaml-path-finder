import type { Tool, DeserializeResult } from '@itsjust/core';
import toolConfig from './tool.config';
import {
  DEFAULT_STATE,
  type ToolState,
  type PathNotation,
  type SelectedPath,
  MAX_SELECTED_PATHS,
} from './types';

const VALID_NOTATIONS: PathNotation[] = ['dot', 'bracket', 'jsonpath'];

/** Serialize tool state into a compact JSON string for share/import. */
export function serializeState(state: ToolState): string {
  return JSON.stringify({
    yamlInput: state.yamlInput,
    pathNotation: state.pathNotation,
    rootPrefix: state.rootPrefix,
    filterQuery: state.filterQuery,
    activeDocIndex: state.activeDocIndex,
    selectedPaths: state.selectedPaths,
    highlightedPath: state.highlightedPath,
    expandedPaths: state.expandedPaths,
    parseError: state.parseError,
  });
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function validSelectedPaths(value: unknown): SelectedPath[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is SelectedPath =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as SelectedPath).path === 'string' &&
        typeof (entry as SelectedPath).value === 'string' &&
        typeof (entry as SelectedPath).type === 'string' &&
        typeof (entry as SelectedPath).createdAt === 'string'
    )
    .slice(0, MAX_SELECTED_PATHS);
}

function validExpandedPaths(value: unknown): Record<string, boolean> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const result: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'boolean') result[k] = v;
  }
  return result;
}

/** Validate and recover tool state from an arbitrary payload. */
export function deserializeState(data: unknown): DeserializeResult<ToolState> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {
      success: false,
      error: 'Invalid data format: expected YAML Path Finder state object',
    };
  }
  const v = data as Record<string, unknown>;
  const notation: PathNotation = VALID_NOTATIONS.includes(v.pathNotation as PathNotation)
    ? (v.pathNotation as PathNotation)
    : DEFAULT_STATE.pathNotation;
  const state: ToolState = {
    yamlInput: stringOr(v.yamlInput, DEFAULT_STATE.yamlInput),
    pathNotation: notation,
    rootPrefix: stringOr(v.rootPrefix, DEFAULT_STATE.rootPrefix),
    filterQuery: stringOr(v.filterQuery, DEFAULT_STATE.filterQuery),
    activeDocIndex: numberOr(v.activeDocIndex, DEFAULT_STATE.activeDocIndex),
    selectedPaths: validSelectedPaths(v.selectedPaths),
    highlightedPath: stringOr(v.highlightedPath, DEFAULT_STATE.highlightedPath),
    expandedPaths: validExpandedPaths(v.expandedPaths),
    parseError:
      v.parseError === null || typeof v.parseError === 'string'
        ? (v.parseError as string | null)
        : null,
  };
  return { success: true, data: state };
}

/** Add a selected path to state, capped at MAX_SELECTED_PATHS. */
export function withSelectedPath(state: ToolState, path: SelectedPath): ToolState {
  if (state.selectedPaths.some((p) => p.path === path.path)) return state;
  return {
    ...state,
    selectedPaths: [path, ...state.selectedPaths].slice(0, MAX_SELECTED_PATHS),
  };
}

/** Remove a selected path by its path string. */
export function withoutSelectedPath(state: ToolState, path: string): ToolState {
  return {
    ...state,
    selectedPaths: state.selectedPaths.filter((p) => p.path !== path),
  };
}

/** Toggle expansion for a node path. */
export function toggleExpanded(state: ToolState, path: string): ToolState {
  return {
    ...state,
    expandedPaths: {
      ...state.expandedPaths,
      [path]: !state.expandedPaths[path],
    },
  };
}

/** True when a serialized string round-trips back to the same state. */
export function roundTrips(state: ToolState): boolean {
  try {
    const restored = deserializeState(JSON.parse(serializeState(state)));
    return restored.success && JSON.stringify(restored.data) === JSON.stringify(state);
  } catch {
    return false;
  }
}

export const yamlPathFinderTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: { ...DEFAULT_STATE },
  serialize: serializeState,
  deserialize: deserializeState,
  exporters: [
    { format: 'png', loader: () => import('./exporters/png') },
    { format: 'jpeg', loader: () => import('./exporters/jpeg') },
    { format: 'webp', loader: () => import('./exporters/webp') },
    { format: 'pdf', loader: () => import('./exporters/pdf') },
  ],
};
