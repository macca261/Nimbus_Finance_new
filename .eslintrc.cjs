module.exports = {
  root: true,
  ignorePatterns: ['dist', 'build', 'coverage', 'node_modules', '**/*.d.ts'],
  env: {
    es2023: true,
    node: true,
    browser: false,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 'latest',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/stylistic',
    'eslint-config-prettier',
  ],
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: ['./backend/tsconfig.json', './web/tsconfig.json'],
      },
    },
  },
  overrides: [
    {
      files: ['backend/src/**/*.ts', 'backend/tests/**/*.ts'],
      env: { node: true, jest: false },
      parserOptions: {
        project: './backend/tsconfig.json',
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        'import/order': [
          'warn',
          {
            'newlines-between': 'always',
            alphabetize: { order: 'asc', caseInsensitive: true },
          },
        ],
      },
    },
    {
      files: ['web/src/**/*.{ts,tsx}'],
      env: { browser: true },
      parserOptions: {
        project: './web/tsconfig.json',
      },
      rules: {
        'react/react-in-jsx-scope': 'off',
      },
    },
    {
      files: ['**/*.spec.ts', '**/*.test.ts'],
      env: { node: true, jest: false },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
      },
    },
  ],
};

