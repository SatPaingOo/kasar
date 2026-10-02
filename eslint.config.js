// @ts-check
// ESLint flat config from the SPO canon, 06-TYPESCRIPT.md section 7. ESLint finds
// code problems and Prettier owns formatting, so eslint-config-prettier comes last.
// Install: npm install --save-dev eslint @eslint/js typescript-eslint eslint-config-prettier prettier
import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/site/**', '**/build/**', '**/coverage/**', '**/.next/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
    },
  },
  // The shelf and the games run in a browser; tools and tests run in Node.
  {
    files: ['src/**/*.ts', 'games/*/src/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['tools/**/*.ts', 'games/*/tests/**/*.ts', 'tests/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
);
