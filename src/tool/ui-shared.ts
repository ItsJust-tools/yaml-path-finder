import { DEFAULT_STATE, type PathNotation, type ToolState } from './types';

export const NOTATIONS: { value: PathNotation; label: string; hint: string }[] = [
  { value: 'dot', label: 'Dot', hint: 'services.web.env[2]' },
  { value: 'bracket', label: 'Bracket', hint: '["services"]["web"]["env"][2]' },
  { value: 'jsonpath', label: 'JSONPath', hint: '$.services.web.env[2]' },
];

export function isState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return (
    typeof v.yamlInput === 'string' &&
    typeof v.pathNotation === 'string' &&
    typeof v.rootPrefix === 'string'
  );
}
