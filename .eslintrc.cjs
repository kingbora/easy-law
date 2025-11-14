/* eslint-disable no-undef */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  reportUnusedDisableDirectives: true,
  ignorePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/out/**',
    '**/.turbo/**',
    '**/coverage/**',
    '.vscode'
  ],
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/consistent-type-imports': [
      'error',
      {
        prefer: 'type-imports',
        disallowTypeAnnotations: false
      }
    ]
  },
  overrides: [
    {
      files: ['*.json', '*.jsonc', '*.json5'],
      parser: 'jsonc-eslint-parser',
      extends: ['plugin:jsonc/recommended-with-json'],
      rules: {
        'jsonc/sort-keys': 'off',
        'jsonc/key-name-casing': 'off',
        '@typescript-eslint/consistent-type-imports': 'off',
        'import/no-extraneous-dependencies': 'off'
      }
    },
    {
      files: ['projects/web-project/**/*.{ts,tsx,js,jsx}'],
      extends: ['next/core-web-vitals'],
      env: {
        browser: true,
        node: true,
        es2022: true
      },
      settings: {
        next: {
          rootDir: 'projects/web-project/'
        },
        react: {
          version: 'detect'
        }
      },
      rules: {
        'react/react-in-jsx-scope': 'off',
        'react/jsx-uses-react': 'off',
        '@next/next/no-html-link-for-pages': 'off',
        'react/jsx-indent': ['error', 2],
        'react/jsx-indent-props': ['error', 2]
      }
    },
    {
      files: ['projects/app-project/**/*.{ts,tsx,js,jsx}'],
      extends: ['next/core-web-vitals'],
      env: {
        browser: true,
        node: true,
        es2022: true
      },
      settings: {
        next: {
          rootDir: 'projects/app-project/'
        },
        react: {
          version: 'detect'
        }
      },
      rules: {
        'react/react-in-jsx-scope': 'off',
        'react/jsx-uses-react': 'off',
        '@next/next/no-html-link-for-pages': 'off',
        'react/jsx-indent': ['error', 2],
        'react/jsx-indent-props': ['error', 2]
      }
    },
    {
      files: ['projects/server-project/**/*.{ts,tsx,js,jsx}'],
      env: {
        node: true,
        es2022: true
      },
      plugins: ['import'],
      rules: {
        'import/order': [
          'error',
          {
            'newlines-between': 'always',
            alphabetize: { order: 'asc', caseInsensitive: true }
          }
        ]
      }
    },
    {
      files: [
        '*.config.{js,cjs,mjs,ts}',
        '**/*.config.{js,cjs,mjs,ts}',
        'packages/**/*.{js,cjs,mjs,ts}'
      ],
      env: {
        node: true
      }
    }
  ]
};
