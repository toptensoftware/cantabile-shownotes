// rollup.config.js
import { rollupPluginHTML as html } from '@web/rollup-plugin-html';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';

export default {
  input: './index.html',
  output: {
    dir: 'dist',
    format: 'es',
    entryFileNames: 'assets/[name]-[hash].js',
    chunkFileNames: 'assets/[name]-[hash].js',
    assetFileNames: 'assets/[name]-[hash][extname]',
  },
  plugins: [
    html({
      rootDir: '.',
    }),
    resolve({ 
      preferBuiltins: true,
      browser: true 
    }),
    commonjs(),
    terser(),
    copy({
      targets: [
        { src: './public/**/*', dest: 'dist/public' },
      ]
    })
  ],
};