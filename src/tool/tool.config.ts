export const toolConfig = {
  id: 'yaml-path-finder',
  name: 'YAML Path Finder',
  category: 'Developer',
  description:
    'Paste YAML and interactively pick nodes to get the exact dot/bracket path for each value, with copy buttons and relative-path support.',
  version: '1.0.0',
  exportFormats: ['png', 'jpeg', 'webp', 'pdf', 'json'] as Array<
    import('@itsjust/core').ExportFormat
  >,
  features: {
    export: true,
    autoSave: true,
    undoRedo: true,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    accent: '#059669',
    accentHover: '#047857',
    accentSubtle: 'rgba(5,150,105,0.1)',
    brand: 'YAML Path Finder',
    icon: '🔍',
  },
  shortcuts: [
    {
      title: 'Navigation',
      shortcuts: [
        { keys: 'Ctrl+F', label: 'Focus filter', description: 'Jump to the filter/search box' },
        { keys: 'Ctrl+Y', label: 'Focus YAML input', description: 'Jump to the YAML textarea' },
      ],
    },
  ],
};

export default toolConfig;
