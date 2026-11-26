import * as jsYaml from 'js-yaml';

export type PathNotation = 'dot' | 'bracket' | 'jsonpath';

export interface SelectedPath {
  /** The full path in the chosen notation. */
  path: string;
  /** The value at this path (stringified). */
  value: string;
  /** Node type label. */
  type: string;
  /** Timestamp when selected. */
  createdAt: string;
}

export interface TreeNode {
  /** Key or index label. */
  key: string;
  /** Display label with type chip. */
  label: string;
  /** Full path in dot notation. */
  path: string;
  /** Value type. */
  type: 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object';
  /** Scalar value when leaf. */
  value?: unknown;
  /** Children for objects/arrays. */
  children?: TreeNode[];
  /** Whether the node is expanded. */
  expanded?: boolean;
  /** Array index if applicable. */
  index?: number;
}

export interface ToolState {
  /** Raw YAML input. */
  yamlInput: string;
  /** Currently selected path notation. */
  pathNotation: PathNotation;
  /** Configurable root prefix. */
  rootPrefix: string;
  /** Current search/filter query. */
  filterQuery: string;
  /** Active document index for multi-document YAML. */
  activeDocIndex: number;
  /** Selected paths. */
  selectedPaths: SelectedPath[];
  /** Currently highlighted node path (last clicked). */
  highlightedPath: string;
  /** Expansion state per node path. */
  expandedPaths: Record<string, boolean>;
  /** Error message if YAML is malformed. */
  parseError: string | null;
}

export const DEFAULT_STATE: ToolState = {
  yamlInput: '',
  pathNotation: 'dot',
  rootPrefix: '$.',
  filterQuery: '',
  activeDocIndex: 0,
  selectedPaths: [],
  highlightedPath: '',
  expandedPaths: {},
  parseError: null,
};

export const MAX_SELECTED_PATHS = 100;

/** Build a TreeNode tree from parsed YAML documents. */
export function buildTree(docs: unknown[]): TreeNode[] {
  if (!docs.length) return [];
  const doc = docs[0];
  if (docs.length === 1) {
    return buildNodeChildren(doc, '');
  }
  return docs.map((d, i) => ({
    key: `document ${i + 1}`,
    label: `document ${i + 1}`,
    path: '',
    type: getNodeType(d),
    children: buildNodeChildren(d, ''),
    expanded: true,
  }));
}

function getNodeType(value: unknown): TreeNode['type'] {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  return 'string';
}

function buildNodeChildren(value: unknown, parentPath: string): TreeNode[] {
  const type = getNodeType(value);
  if (type === 'array') {
    return (value as unknown[]).map((item, idx) => {
      const childPath = parentPath ? `${parentPath}[${idx}]` : `[${idx}]`;
      const childType = getNodeType(item);
      return {
        key: String(idx),
        label: `[${idx}]`,
        path: childPath,
        type: childType,
        value: childType === 'array' || childType === 'object' ? undefined : item,
        children:
          childType === 'array' || childType === 'object'
            ? buildNodeChildren(item, childPath)
            : undefined,
        index: idx,
      };
    });
  }
  if (type === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj).map((k) => {
      const childPath = parentPath ? `${parentPath}.${k}` : k;
      const childType = getNodeType(obj[k]);
      return {
        key: k,
        label: k,
        path: childPath,
        type: childType,
        value: childType === 'array' || childType === 'object' ? undefined : obj[k],
        children:
          childType === 'array' || childType === 'object'
            ? buildNodeChildren(obj[k], childPath)
            : undefined,
      };
    });
  }
  return [];
}

/** Convert a dot path to bracket notation. */
export function toBracketPath(path: string): string {
  if (!path) return '';
  let result = '';
  let i = 0;
  while (i < path.length) {
    if (path[i] === '.') {
      i++;
      continue;
    }
    if (path[i] === '[') {
      const end = path.indexOf(']', i);
      result += path.slice(i, end + 1);
      i = end + 1;
    } else {
      const end = path.indexOf('.', i);
      const endBracket = path.indexOf('[', i);
      const stop =
        end === -1
          ? endBracket === -1
            ? path.length
            : endBracket
          : endBracket === -1
            ? end
            : Math.min(end, endBracket);
      result += `[${JSON.stringify(path.slice(i, stop))}]`;
      i = stop;
    }
  }
  return result;
}

/** Convert a dot path to JSONPath notation. */
export function toJsonPath(path: string): string {
  if (!path) return '$';
  const bracket = toBracketPath(path);
  return '$' + bracket;
}

/** Format a path with the chosen notation and prefix. */
export function formatPath(path: string, notation: PathNotation, prefix: string): string {
  if (!path) return prefix;
  switch (notation) {
    case 'dot':
      return prefix + path;
    case 'bracket':
      return prefix + toBracketPath(path);
    case 'jsonpath':
      return toJsonPath(path);
    default:
      return prefix + path;
  }
}

/** Extract all scalar paths as key-value pairs. */
export function extractAllPaths(
  docs: unknown[]
): Array<{ path: string; value: string; type: string }> {
  const results: Array<{ path: string; value: string; type: string }> = [];
  if (!docs.length) return results;
  const doc = docs[0];
  walkForPaths(doc, '', results);
  return results;
}

function walkForPaths(
  value: unknown,
  path: string,
  results: Array<{ path: string; value: string; type: string }>
): void {
  const type = getNodeType(value);
  if (type === 'array') {
    (value as unknown[]).forEach((item, idx) => {
      const childPath = path ? `${path}[${idx}]` : `[${idx}]`;
      walkForPaths(item, childPath, results);
    });
  } else if (type === 'object') {
    const obj = value as Record<string, unknown>;
    Object.keys(obj).forEach((k) => {
      const childPath = path ? `${path}.${k}` : k;
      walkForPaths(obj[k], childPath, results);
    });
  } else {
    results.push({ path, value: String(value), type });
  }
}

/** Check if a node or any descendant matches the filter query. */
export function nodeMatchesFilter(node: TreeNode, query: string): boolean {
  if (!query) return true;
  const lower = query.toLowerCase();
  const label = String(node.label).toLowerCase();
  const val = node.value !== undefined ? String(node.value).toLowerCase() : '';
  const type = node.type.toLowerCase();
  if (label.includes(lower) || val.includes(lower) || type.includes(lower)) return true;
  if (node.children) {
    return node.children.some((c) => nodeMatchesFilter(c, lower));
  }
  return false;
}

/** Prune tree to only matching nodes and their ancestors. */
export function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query) return nodes;
  const lower = query.toLowerCase();
  const result: TreeNode[] = [];
  for (const node of nodes) {
    const match = nodeMatchesFilter(node, lower);
    const filteredChildren = node.children ? filterTree(node.children, lower) : undefined;
    if (match || (filteredChildren && filteredChildren.length > 0)) {
      result.push({ ...node, children: filteredChildren });
    }
  }
  return result;
}

/** Parse YAML into documents array; returns null with error message on failure. */
export function tryParseYaml(yamlText: string): { docs: unknown[]; error: string | null } {
  try {
    const yaml = jsYaml;
    const docs = yaml.loadAll(yamlText) as unknown[];
    return { docs, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid YAML';
    return { docs: [], error: msg };
  }
}

export function isState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return (
    typeof v.yamlInput === 'string' &&
    typeof v.pathNotation === 'string' &&
    typeof v.rootPrefix === 'string'
  );
}
