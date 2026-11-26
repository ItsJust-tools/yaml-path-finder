'use client';

import React from 'react';
import { NOTATIONS } from '../ui-shared';
import { type ToolState } from '../types';

interface SidebarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ state }) => {
  return (
    <div
      className="p-4 space-y-6 text-sm overflow-y-auto h-full"
      data-testid="yaml-path-finder-sidebar"
    >
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Path Notations</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          {NOTATIONS.map((n) => (
            <li key={n.value} className="flex justify-between gap-2">
              <span>{n.label}</span>
              <span className="text-gray-500 dark:text-gray-400 font-mono">{n.hint}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Selected Paths</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300" data-testid="sidebar-path-count">
          {state.selectedPaths.length} path{state.selectedPaths.length === 1 ? '' : 's'} selected
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Keyboard Shortcuts</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <li>
            <kbd>Ctrl+F</kbd> — Focus filter
          </li>
          <li>
            <kbd>Ctrl+Y</kbd> — Focus YAML input
          </li>
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Share</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Use the toolbar share button to create a URL containing your YAML and selections.
        </p>
      </div>
    </div>
  );
};
