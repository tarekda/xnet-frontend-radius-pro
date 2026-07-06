import globals from 'globals'
import * as reactHooksMod from 'eslint-plugin-react-hooks'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

const reactHooks = reactHooksMod.default ?? reactHooksMod

export default [
  { ignores: ['dist', 'next-app/.next', 'next-app/next-env.d.ts', '**/node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // Keep signal, but don't block dev builds yet (legacy codebase has many violations).
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',
      ...reactHooks.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]
