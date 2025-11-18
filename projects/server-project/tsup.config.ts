import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['cjs'], // Express 通常使用 CommonJS
  clean: true,
  sourcemap: true,
  minify: false, // Express 服务通常不需要压缩
  target: 'node20',
  platform: 'node',
  
  // 外部化所有 node_modules
  external: [
    /node_modules/,
  ],
  noExternal: [
    /^@easy-law\//,
  ],
  // 保持目录结构
  splitting: false,
  treeshake: false,
})