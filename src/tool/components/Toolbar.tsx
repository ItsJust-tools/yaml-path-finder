'use client';

import React from 'react';
import { formatPath, tryParseYaml, extractAllPaths, type ToolState } from '../types';

interface ToolbarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
  onClear: () => void;
  onCopy?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ state, onChange, onClear, onCopy }) => {
  const { docs } = tryParseYaml(state.yamlInput);

  const handleExtractAll = React.useCallback(() => {
    const paths = extractAllPaths(docs);
    const selected = paths.map((p) => ({
      path: formatPath(p.path, state.pathNotation, state.rootPrefix),
      value: p.value,
      type: p.type,
      createdAt: new Date().toISOString(),
    }));
    onChange({ ...state, selectedPaths: selected.slice(0, 100) });
  }, [docs, state, onChange]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2" role="group" aria-label="YAML Path Finder controls">
        <button
          type="button"
          onClick={onClear}
          data-testid="btn-clear"
          className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Clear
        </button>
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            data-testid="btn-copy-result"
            className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
          >
            Copy result
          </button>
        ) : null}
        {docs.length > 0 ? (
          <button
            type="button"
            onClick={handleExtractAll}
            data-testid="btn-extract-all"
            className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Extract all paths
          </button>
        ) : null}
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400" data-testid="toolbar-doc-count">
        {docs.length > 1
          ? `${docs.length} documents`
          : docs.length === 1
            ? '1 document'
            : 'No documents'}
      </span>
    </div>
  );
};
