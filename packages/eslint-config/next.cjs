module.exports = {
  extends: ['next/core-web-vitals', require.resolve('./base.cjs')],
  env: {
    browser: true,
    es2022: true,
    node: true
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/jsx-uses-react': 'off',
    '@next/next/no-html-link-for-pages': 'off'
  }
};
