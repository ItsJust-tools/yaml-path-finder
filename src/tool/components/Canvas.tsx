'use client';

import React, { useCallback, useMemo, useRef } from 'react';
import {
  buildTree,
  filterTree,
  formatPath,
  tryParseYaml,
  type ToolState,
  type TreeNode,
  type PathNotation,
} from '../types';

interface CanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
  onSaveHistory?: (text: string) => void;
}

function CopyButton({ value, testid }: { value: string; testid?: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      data-testid={testid}
      className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-label="Copy value"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function TypeChip({ type }: { type: TreeNode['type'] }) {
  const colors: Record<TreeNode['type'], string> = {
    string: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    number: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    boolean: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
    null: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    array: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    object: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  };
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${colors[type]}`}
    >
      {type}
    </span>
  );
}

function TreeNodeItem({
  node,
  state,
  onChange,
  depth = 0,
}: {
  node: TreeNode;
  state: ToolState;
  onChange?: (state: ToolState) => void;
  depth?: number;
}) {
  const expanded =
    state.expandedPaths[node.path] ??
    (node.children !== undefined && node.children.length > 0 ? false : undefined);
  const isHighlighted = state.highlightedPath === node.path;
  const hasChildren = node.children && node.children.length > 0;

  const formattedPath = useMemo(
    () => formatPath(node.path, state.pathNotation, state.rootPrefix),
    [node.path, state.pathNotation, state.rootPrefix]
  );

  const handleToggle = useCallback(() => {
    if (!hasChildren) return;
    onChange?.({
      ...state,
      expandedPaths: { ...state.expandedPaths, [node.path]: !expanded },
    });
  }, [hasChildren, expanded, node.path, state, onChange]);

  const handleSelect = useCallback(() => {
    const newState: ToolState = { ...state, highlightedPath: node.path };
    if (node.type !== 'array' && node.type !== 'object') {
      const newPath = {
        path: formattedPath,
        value: String(node.value ?? ''),
        type: node.type,
        createdAt: new Date().toISOString(),
      };
      if (!state.selectedPaths.some((p) => p.path === newPath.path)) {
        newState.selectedPaths = [newPath, ...state.selectedPaths].slice(0, 100);
      }
    }
    onChange?.(newState);
  }, [node, state, onChange, formattedPath]);

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-1.5 rounded px-1 py-0.5 cursor-pointer ${
          isHighlighted
            ? 'bg-emerald-50 dark:bg-emerald-900/20'
            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
        }`}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={handleSelect}
        data-testid={`tree-node-${node.path || 'root'}`}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
            className="w-4 h-4 flex items-center justify-center text-[10px] text-gray-500"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <TypeChip type={node.type} />
        <span className="text-sm font-mono text-gray-800 dark:text-gray-200">{node.label}</span>
        {node.value !== undefined && (
          <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[200px]">
            {String(node.value)}
          </span>
        )}
        {isHighlighted && (
          <CopyButton value={formattedPath} testid={`copy-path-${node.path || 'root'}`} />
        )}
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNodeItem
              key={child.path}
              node={child}
              state={state}
              onChange={onChange}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const Canvas: React.FC<CanvasProps> = ({ state, onChange }) => {
  const filterRef = useRef<HTMLInputElement>(null);
  const { docs, error } = useMemo(() => tryParseYaml(state.yamlInput), [state.yamlInput]);
  const tree = useMemo(() => buildTree(docs), [docs]);
  const filteredTree = useMemo(
    () => filterTree(tree, state.filterQuery),
    [tree, state.filterQuery]
  );

  const handleNotationChange = useCallback(
    (notation: PathNotation) => {
      onChange?.({ ...state, pathNotation: notation });
    },
    [state, onChange]
  );

  const handleFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.({ ...state, filterQuery: e.target.value });
    },
    [state, onChange]
  );

  const handleYamlChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.({ ...state, yamlInput: e.target.value });
    },
    [state, onChange]
  );

  const handleClear = useCallback(() => {
    onChange?.({ ...state, selectedPaths: [], highlightedPath: '', filterQuery: '' });
  }, [state, onChange]);

  const handleRootPrefixChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.({ ...state, rootPrefix: e.target.value });
    },
    [state, onChange]
  );

  const handleRemoveSelected = useCallback(
    (path: string) => {
      onChange?.({
        ...state,
        selectedPaths: state.selectedPaths.filter((p) => p.path !== path),
      });
    },
    [state, onChange]
  );

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full" data-testid="yaml-path-finder-canvas">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              YAML Input
            </label>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {docs.length > 1 ? `${docs.length} documents` : '1 document'}
            </span>
          </div>
          <textarea
            value={state.yamlInput}
            onChange={handleYamlChange}
            data-testid="yaml-input"
            placeholder="Paste YAML here..."
            className="w-full h-48 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-mono text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 resize-y"
          />
          {error && (
            <div
              className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-200"
              data-testid="yaml-error"
            >
              {error}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Tree Explorer
            </label>
            <div className="flex gap-2">
              <input
                ref={filterRef}
                type="text"
                value={state.filterQuery}
                onChange={handleFilterChange}
                placeholder="Filter by key or value..."
                data-testid="filter-input"
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <button
                type="button"
                onClick={handleClear}
                data-testid="btn-clear-selections"
                className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center text-xs">
            <span className="text-gray-500 dark:text-gray-400">Path notation:</span>
            {(['dot', 'bracket', 'jsonpath'] as PathNotation[]).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleNotationChange(n)}
                data-testid={`notation-${n}`}
                className={`rounded-md border px-2 py-1 text-xs font-medium ${
                  state.pathNotation === n
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'
                }`}
              >
                {n === 'dot' ? 'Dot' : n === 'bracket' ? 'Bracket' : 'JSONPath'}
              </button>
            ))}
            <label className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
              Prefix:
              <input
                type="text"
                value={state.rootPrefix}
                onChange={handleRootPrefixChange}
                data-testid="root-prefix"
                className="w-16 rounded-md border border-gray-300 bg-white px-1 py-0.5 text-xs font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>
          </div>

          <div
            className="rounded-md border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900 overflow-y-auto max-h-96"
            data-testid="tree-view"
          >
            {filteredTree.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="tree-empty">
                {state.yamlInput ? 'No matching nodes.' : 'Paste YAML to see the tree.'}
              </p>
            ) : (
              filteredTree.map((node) => (
                <TreeNodeItem
                  key={node.path || node.key}
                  node={node}
                  state={state}
                  onChange={onChange}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {state.selectedPaths.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Selected Paths ({state.selectedPaths.length})
          </h3>
          <ul className="space-y-1" data-testid="selected-paths-list">
            {state.selectedPaths.map((p) => (
              <li
                key={p.path}
                className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-xs dark:border-gray-800"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <TypeChip type={p.type as TreeNode['type']} />
                  <span className="font-mono text-gray-700 dark:text-gray-300 truncate">
                    {p.path}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 truncate">= {p.value}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <CopyButton value={p.path} testid={`copy-selected-${p.path}`} />
                  <button
                    type="button"
                    onClick={() => handleRemoveSelected(p.path)}
                    data-testid={`remove-selected-${p.path}`}
                    className="rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-center text-xs text-gray-500 dark:text-gray-400">
        All processing runs locally in your browser; nothing is uploaded.
      </p>
    </div>
  );
};
