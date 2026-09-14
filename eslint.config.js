import js from '@eslint/js';
import { configs as astroConfigs } from 'eslint-plugin-astro';
import prettier from 'eslint-config-prettier';
import { createNodeResolver, flatConfigs as importX } from 'eslint-plugin-import-x';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const SCOPE = '@trayectoria';
const PACKAGES = ['sim-core', 'robot-spec', 'widgets', 'sims', 'progress', 'auth', 'db', 'i18n'];

// Allowed internal imports per docs/ARCHITECTURE.md §2. Anything else is an architecture error.
const ALLOWED_IMPORTS = {
  'apps/web': ['sims', 'widgets', 'progress', 'auth', 'db', 'i18n', 'robot-spec'],
  'packages/sims': ['sim-core', 'widgets', 'robot-spec', 'i18n', 'progress'],
  'packages/widgets': ['sim-core', 'robot-spec', 'i18n'],
  'packages/progress': ['db', 'auth'],
  'packages/auth': ['db'],
  'packages/sim-core': [],
  'packages/robot-spec': [],
  'packages/db': [],
  'packages/i18n': [],
};

const architectureBoundaries = Object.entries(ALLOWED_IMPORTS).map(([dir, allowed]) => {
  const forbidden = PACKAGES.filter(
    (name) => !allowed.includes(name) && dir !== `packages/${name}`,
  );
  const message = `${dir} may only import ${allowed.length ? allowed.join(', ') : 'nothing internal'} (docs/ARCHITECTURE.md §2).`;
  return {
    files: [`${dir}/**/*.{ts,tsx,astro}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: forbidden.flatMap((name) => [`${SCOPE}/${name}`, `${SCOPE}/${name}/*`]),
              message,
            },
            { group: ['**/apps/*', '**/apps/*/**'], message: 'Packages never import from apps/.' },
          ],
        },
      ],
      'import-x/no-restricted-paths': [
        'error',
        {
          basePath: import.meta.dirname,
          zones: [
            {
              target: `./${dir}`,
              from: [
                ...forbidden.map((name) => `./packages/${name}`),
                ...(dir.startsWith('apps/') ? [] : ['./apps']),
              ],
              message,
            },
          ],
        },
      ],
    },
  };
});

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/.astro/',
      '**/coverage/',
      'docs/',
      'pnpm-lock.yaml',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  importX.recommended,
  ...astroConfigs['flat/recommended'],
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import-x/resolver-next': [
        createNodeResolver({ extensions: ['.ts', '.tsx', '.js', '.mjs', '.json'] }),
      ],
    },
    rules: {
      // docs/STANDARDS.md §2
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      // docs/STANDARDS.md §4
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true }],
      // docs/STANDARDS.md §10
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message: 'localStorage is only allowed inside stores/ (docs/STANDARDS.md §10).',
        },
      ],
      'import-x/no-unresolved': 'off',
      // DESIGN.md §8: thin space (U+2009) before units in visible text.
      'no-irregular-whitespace': [
        'error',
        { skipStrings: true, skipTemplates: true, skipJSXText: true },
      ],
    },
  },
  {
    files: ['packages/**/*.{ts,tsx,astro}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'window is only allowed in apps/web (docs/STANDARDS.md §10).' },
        {
          name: 'localStorage',
          message: 'localStorage is only allowed inside stores/ (docs/STANDARDS.md §10).',
        },
      ],
    },
  },
  {
    files: ['packages/**/stores/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'window is only allowed in apps/web.' },
      ],
    },
  },
  {
    files: ['apps/**/stores/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': 'off',
    },
  },
  {
    files: ['packages/sim-core/**/*.ts', 'packages/robot-spec/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use SeededRng (docs/STANDARDS.md §10).' },
        {
          object: 'Date',
          property: 'now',
          message: 'Time comes from the simulation clock (docs/STANDARDS.md §10).',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'sim-core and robot-spec have no DOM.' },
        { name: 'document', message: 'sim-core and robot-spec have no DOM.' },
        { name: 'localStorage', message: 'sim-core and robot-spec have no DOM.' },
      ],
    },
  },
  ...architectureBoundaries,
  {
    files: ['**/*.test.{ts,tsx}', '**/*.stories.tsx', '**/e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-assertions': 'off',
      'max-lines-per-function': 'off',
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // astro-eslint-parser has no stable TypeScript program; astro check covers types (ADR-0007).
    files: ['**/*.astro'],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      // Template text is content: thin spaces before units are required (DESIGN.md §8).
      'no-irregular-whitespace': 'off',
    },
  },
  prettier,
);
