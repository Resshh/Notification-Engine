// Code checks for the server. Run: npm run lint
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/', 'reports/output/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      // A leading _ marks a parameter that must exist but isn't used (e.g. Express's 4-argument error handler).
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-duplicate-imports': 'error',
      'no-shadow': 'error',
      'no-self-compare': 'error',
      eqeqeq: ['error', 'smart'],
    },
  },
];
