module.exports = {
  extends: [require.resolve('./base.cjs')],
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
    ],
  }
};
