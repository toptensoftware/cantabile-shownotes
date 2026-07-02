// rollup.config.js
import { rollupPluginHTML as html } from '@web/rollup-plugin-html';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';
import replace from '@rollup/plugin-replace';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));


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
      preferBuiltins: false,
      browser: true 
    }),
    replace({
      preventAssignment: true,
      __PACKAGE_VERSION__: JSON.stringify(pkg.version),
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