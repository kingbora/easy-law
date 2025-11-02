module.exports = {
  root: true,
  extends: ['@easy-law/eslint-config/base'],
  ignorePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/out/**',
    '**/.turbo/**',
    '**/coverage/**',
    '.vscode'
  ],
  overrides: [
    {
      files: ['projects/web-project/**/*.{ts,tsx,js,jsx}'],
      extends: ['@easy-law/eslint-config/next'],
      settings: {
        next: {
          rootDir: 'projects/web-project/'
        }
      }
    },
    {
      files: ['projects/server-project/**/*.{ts,tsx,js,jsx}'],
      extends: ['@easy-law/eslint-config/node']
    },
    {
      files: ['projects/app-project/**/*.{ts,tsx,js,jsx}'],
      extends: ['@easy-law/eslint-config/next'],
      settings: {
        next: {
          rootDir: 'projects/app-project/'
        }
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
