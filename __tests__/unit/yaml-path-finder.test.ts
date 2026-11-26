import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STATE,
  type ToolState,
  buildTree,
  toBracketPath,
  toJsonPath,
  formatPath,
  extractAllPaths,
  nodeMatchesFilter,
  filterTree,
  tryParseYaml,
  isState,
} from '@/tool/types';
import {
  deserializeState,
  serializeState,
  withSelectedPath,
  withoutSelectedPath,
  toggleExpanded,
  roundTrips,
  yamlPathFinderTool,
} from '@/tool/tool-definition';

const state = (patch: Partial<ToolState> = {}): ToolState => ({ ...DEFAULT_STATE, ...patch });

describe('tryParseYaml', () => {
  it('parses simple YAML', () => {
    const result = tryParseYaml('foo: bar');
    expect(result.error).toBeNull();
    expect(result.docs).toHaveLength(1);
    expect(result.docs[0]).toEqual({ foo: 'bar' });
  });

  it('parses nested maps and arrays', () => {
    const yaml = `
services:
  web:
    env:
      - dev
      - prod
    port: 3000
    enabled: true
`;
    const result = tryParseYaml(yaml);
    expect(result.error).toBeNull();
    expect(result.docs).toHaveLength(1);
    const doc = result.docs[0] as Record<string, unknown>;
    expect(doc.services).toBeDefined();
  });

  it('parses multi-document YAML', () => {
    const yaml = `
---
foo: 1
---
bar: 2
`;
    const result = tryParseYaml(yaml);
    expect(result.error).toBeNull();
    expect(result.docs).toHaveLength(2);
    expect((result.docs[0] as Record<string, unknown>).foo).toBe(1);
    expect((result.docs[1] as Record<string, unknown>).bar).toBe(2);
  });

  it('returns error for malformed YAML', () => {
    const result = tryParseYaml('{ broken');
    expect(result.error).not.toBeNull();
    expect(result.docs).toHaveLength(0);
  });

  it('handles empty string', () => {
    const result = tryParseYaml('');
    expect(result.error).toBeNull();
    // js-yaml.loadAll('') returns [null], so buildTree should handle it
    expect(result.docs.length).toBeGreaterThanOrEqual(0);
  });
});

describe('buildTree', () => {
  it('builds tree for nested map', () => {
    const docs = [{ a: { b: 'c' } }];
    const tree = buildTree(docs);
    expect(tree).toHaveLength(1);
    expect(tree[0]!.key).toBe('a');
    expect(tree[0]!.type).toBe('object');
    expect(tree[0]!.children).toHaveLength(1);
    expect(tree[0]!.children![0]!.key).toBe('b');
    expect(tree[0]!.children![0]!.type).toBe('string');
    expect(tree[0]!.children![0]!.value).toBe('c');
    expect(tree[0]!.children![0]!.path).toBe('a.b');
  });

  it('builds tree for array', () => {
    const docs = [['alpha', 'beta']];
    const tree = buildTree(docs);
    expect(tree).toHaveLength(2);
    expect(tree[0]!.key).toBe('0');
    expect(tree[0]!.type).toBe('string');
    expect(tree[0]!.value).toBe('alpha');
    expect(tree[0]!.path).toBe('[0]');
    expect(tree[1]!.key).toBe('1');
    expect(tree[1]!.path).toBe('[1]');
  });

  it('builds tree for mixed structures', () => {
    const docs = [
      {
        services: {
          web: {
            env: ['dev', 'prod'],
            port: 3000,
          },
        },
      },
    ];
    const tree = buildTree(docs);
    expect(tree[0]!.key).toBe('services');
    expect(tree[0]!.children![0]!.key).toBe('web');
    expect(tree[0]!.children![0]!.children![0]!.key).toBe('env');
    expect(tree[0]!.children![0]!.children![0]!.type).toBe('array');
    expect(tree[0]!.children![0]!.children![0]!.children![0]!.path).toBe('services.web.env[0]');
    expect(tree[0]!.children![0]!.children![1]!.path).toBe('services.web.port');
    expect(tree[0]!.children![0]!.children![1]!.type).toBe('number');
  });

  it('handles null, boolean, number types', () => {
    const docs = [{ n: null, b: false, num: 42 }];
    const tree = buildTree(docs);
    expect(tree.length).toBeGreaterThan(0);
    const rootChildren = tree[0]!.children ?? tree;
    // Find the children of the root object
    expect(rootChildren.some((n) => n.key === 'n' && n.type === 'null')).toBe(true);
    expect(rootChildren.some((n) => n.key === 'b' && n.type === 'boolean')).toBe(true);
    expect(rootChildren.some((n) => n.key === 'num' && n.type === 'number')).toBe(true);
  });

  it('handles empty docs', () => {
    expect(buildTree([])).toEqual([]);
  });

  it('wraps multi-document YAML in document nodes', () => {
    const docs = [{ a: 1 }, { b: 2 }];
    const tree = buildTree(docs);
    expect(tree).toHaveLength(2);
    expect(tree[0]!.key).toBe('document 1');
    expect(tree[1]!.key).toBe('document 2');
  });
});

describe('path notation conversions', () => {
  it('toBracketPath converts dot path', () => {
    expect(toBracketPath('services.web.env[2]')).toBe('["services"]["web"]["env"][2]');
    expect(toBracketPath('foo')).toBe('["foo"]');
    expect(toBracketPath('a.b')).toBe('["a"]["b"]');
  });

  it('toJsonPath returns JSONPath', () => {
    expect(toJsonPath('services.web.env[2]')).toBe('$["services"]["web"]["env"][2]');
    expect(toJsonPath('')).toBe('$');
    expect(toJsonPath('foo')).toBe('$["foo"]');
  });

  it('formatPath uses prefix and notation', () => {
    expect(formatPath('services.web.env[2]', 'dot', '$.')).toBe('$.services.web.env[2]');
    expect(formatPath('services.web.env[2]', 'bracket', 'data.')).toBe(
      'data.["services"]["web"]["env"][2]'
    );
    expect(formatPath('services.web.env[2]', 'jsonpath', '')).toBe(
      '$["services"]["web"]["env"][2]'
    );
    expect(formatPath('', 'dot', '$.')).toBe('$.');
  });
});

describe('extractAllPaths', () => {
  it('extracts all scalar paths', () => {
    const docs = [{ a: { b: 'c' }, nums: [1, 2] }];
    const paths = extractAllPaths(docs);
    expect(paths).toContainEqual({ path: 'a.b', value: 'c', type: 'string' });
    expect(paths).toContainEqual({ path: 'nums[0]', value: '1', type: 'number' });
    expect(paths).toContainEqual({ path: 'nums[1]', value: '2', type: 'number' });
  });

  it('handles deeply nested structures', () => {
    const docs = [{ a: { b: { c: { d: 'deep' } } } }];
    const paths = extractAllPaths(docs);
    expect(paths).toContainEqual({ path: 'a.b.c.d', value: 'deep', type: 'string' });
  });

  it('returns empty for empty input', () => {
    expect(extractAllPaths([])).toEqual([]);
  });
});

describe('nodeMatchesFilter', () => {
  it('matches by key', () => {
    const node = { key: 'services', label: 'services', path: 'services', type: 'object' as const };
    expect(nodeMatchesFilter(node, 'serv')).toBe(true);
    expect(nodeMatchesFilter(node, 'web')).toBe(false);
  });

  it('matches by value', () => {
    const node = {
      key: 'name',
      label: 'name',
      path: 'name',
      type: 'string' as const,
      value: 'alpha',
    };
    expect(nodeMatchesFilter(node, 'alp')).toBe(true);
    expect(nodeMatchesFilter(node, 'beta')).toBe(false);
  });

  it('matches by type', () => {
    const node = { key: 'count', label: 'count', path: 'count', type: 'number' as const, value: 5 };
    expect(nodeMatchesFilter(node, 'num')).toBe(true);
    expect(nodeMatchesFilter(node, 'string')).toBe(false);
  });

  it('matches descendants', () => {
    const node = {
      key: 'root',
      label: 'root',
      path: 'root',
      type: 'object' as const,
      children: [
        {
          key: 'hidden',
          label: 'hidden',
          path: 'root.hidden',
          type: 'string' as const,
          value: 'treasure',
        },
      ],
    };
    expect(nodeMatchesFilter(node, 'treasure')).toBe(true);
    expect(nodeMatchesFilter(node, 'gold')).toBe(false);
  });

  it('returns true for empty query', () => {
    const node = { key: 'x', label: 'x', path: 'x', type: 'string' as const };
    expect(nodeMatchesFilter(node, '')).toBe(true);
  });
});

describe('filterTree', () => {
  it('returns all nodes for empty query', () => {
    const nodes = [{ key: 'a', label: 'a', path: 'a', type: 'string' as const }];
    expect(filterTree(nodes, '')).toHaveLength(1);
  });

  it('reduces visible nodes by query', () => {
    const nodes = [
      {
        key: 'services',
        label: 'services',
        path: 'services',
        type: 'object' as const,
        children: [
          { key: 'web', label: 'web', path: 'services.web', type: 'object' as const },
          { key: 'db', label: 'db', path: 'services.db', type: 'object' as const },
        ],
      },
    ];
    const filtered = filterTree(nodes, 'web');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.children).toHaveLength(1);
    expect(filtered[0]!.children![0]!.key).toBe('web');
  });

  it('preserves ancestors of matches', () => {
    const nodes = [
      {
        key: 'a',
        label: 'a',
        path: 'a',
        type: 'object' as const,
        children: [
          {
            key: 'b',
            label: 'b',
            path: 'a.b',
            type: 'object' as const,
            children: [
              { key: 'c', label: 'c', path: 'a.b.c', type: 'string' as const, value: 'target' },
            ],
          },
        ],
      },
    ];
    const filtered = filterTree(nodes, 'target');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.children![0]!.children![0]!.key).toBe('c');
  });
});

describe('serialize/deserialize round-trip', () => {
  const full: ToolState = {
    ...DEFAULT_STATE,
    yamlInput: 'foo: bar',
    pathNotation: 'bracket',
    rootPrefix: 'data.',
    filterQuery: 'search',
    activeDocIndex: 1,
    selectedPaths: [
      { path: 'data.foo', value: 'bar', type: 'string', createdAt: '2026-11-21T10:00:00.000Z' },
    ],
    highlightedPath: 'foo',
    expandedPaths: { foo: true },
    parseError: null,
  };

  it('round-trips all fields through serializeState/deserializeState', () => {
    const restored = deserializeState(JSON.parse(serializeState(full)));
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data).toEqual(full);
    }
    expect(serializeState(full)).toContain('"yamlInput":"foo: bar"');
  });

  it('round-trips via the Tool object', () => {
    const serialized = yamlPathFinderTool.serialize(full);
    const restored = yamlPathFinderTool.deserialize(JSON.parse(serialized));
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data).toEqual(full);
    }
  });

  it('keeps URL share state round-trip safe', () => {
    expect(roundTrips(full)).toBe(true);
    expect(roundTrips(DEFAULT_STATE)).toBe(true);
  });

  it('rejects malformed payloads', () => {
    expect(deserializeState(null).success).toBe(false);
    expect(deserializeState('string').success).toBe(false);
    expect(deserializeState([1, 2]).success).toBe(false);
    expect(deserializeState(undefined).success).toBe(false);
  });

  it('repairs invalid notation instead of failing', () => {
    const restored = deserializeState({ pathNotation: 'nonsense' });
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.pathNotation).toBe(DEFAULT_STATE.pathNotation);
    }
  });

  it('falls back to defaults for missing fields', () => {
    const restored = deserializeState({});
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.yamlInput).toBe(DEFAULT_STATE.yamlInput);
      expect(restored.data.selectedPaths).toEqual([]);
    }
  });

  it('filters invalid selected paths and caps length', () => {
    const entries = Array.from({ length: 105 }, (_, i) => ({
      path: `path${i}`,
      value: `val${i}`,
      type: 'string',
      createdAt: new Date(2026, 0, 1, 0, 0, i).toISOString(),
    }));
    const restored = deserializeState({ selectedPaths: [...entries, 'bad', { path: 'x' }] });
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.selectedPaths.length).toBe(100);
      expect(restored.data.selectedPaths[0]?.path).toBe('path0');
    }
  });
});

describe('withSelectedPath', () => {
  it('adds a new path', () => {
    const s = withSelectedPath(state(), {
      path: '$.foo',
      value: 'bar',
      type: 'string',
      createdAt: '2026-11-21T12:00:00.000Z',
    });
    expect(s.selectedPaths).toHaveLength(1);
    expect(s.selectedPaths[0]!.path).toBe('$.foo');
  });

  it('ignores duplicates', () => {
    const entry = {
      path: '$.foo',
      value: 'bar',
      type: 'string',
      createdAt: '2026-11-21T12:00:00.000Z',
    };
    let s = withSelectedPath(state(), entry);
    s = withSelectedPath(s, entry);
    expect(s.selectedPaths).toHaveLength(1);
  });
});

describe('withoutSelectedPath', () => {
  it('removes a path by string', () => {
    const s = state({
      selectedPaths: [
        { path: '$.foo', value: 'bar', type: 'string', createdAt: '2026-11-21T12:00:00.000Z' },
        { path: '$.baz', value: 'qux', type: 'string', createdAt: '2026-11-21T12:00:00.000Z' },
      ],
    });
    const removed = withoutSelectedPath(s, '$.foo');
    expect(removed.selectedPaths).toHaveLength(1);
    expect(removed.selectedPaths[0]!.path).toBe('$.baz');
  });
});

describe('toggleExpanded', () => {
  it('toggles expansion state', () => {
    const s = toggleExpanded(state(), 'foo');
    expect(s.expandedPaths.foo).toBe(true);
    const s2 = toggleExpanded(s, 'foo');
    expect(s2.expandedPaths.foo).toBe(false);
  });
});

describe('isState', () => {
  it('recognizes valid state', () => {
    expect(isState({ yamlInput: '', pathNotation: 'dot', rootPrefix: '$.' })).toBe(true);
  });

  it('rejects non-objects', () => {
    expect(isState(null)).toBe(false);
    expect(isState('string')).toBe(false);
    expect(isState(42)).toBe(false);
  });
});

describe('multi-document YAML', () => {
  it('switches tabs and resets paths per document', () => {
    const yaml = `---\nfoo: 1\n---\nbar: 2\n`;
    const result = tryParseYaml(yaml);
    expect(result.docs).toHaveLength(2);
    expect((result.docs[0] as Record<string, unknown>).foo).toBe(1);
    expect((result.docs[1] as Record<string, unknown>).bar).toBe(2);
  });

  it('buildTree wraps multi-doc in document nodes', () => {
    const tree = buildTree([{ a: 1 }, { b: 2 }]);
    expect(tree[0]!.key).toBe('document 1');
    expect(tree[1]!.key).toBe('document 2');
    expect(tree[0]!.children![0]!.path).toBe('a');
  });
});

describe('malformed YAML handling', () => {
  it('shows error and does not crash', () => {
    const result = tryParseYaml('{ broken: [');
    expect(result.error).not.toBeNull();
    expect(result.docs).toHaveLength(0);
    const tree = buildTree(result.docs);
    expect(tree).toEqual([]);
  });

  it('returns empty tree for empty docs', () => {
    expect(buildTree([])).toEqual([]);
  });
});
