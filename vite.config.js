// Vite config — path aliases, GLSL shader imports as strings, build target.
import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    glsl({
      include: ['**/*.glsl', '**/*.vert', '**/*.frag'],
      compress: false,
      watch: true,
      defaultExtension: 'glsl',
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@modules': resolve(__dirname, 'src/modules'),
      '@shaders': resolve(__dirname, 'src/shaders'),
      '@content': resolve(__dirname, 'src/content'),
      '@styles': resolve(__dirname, 'src/styles'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020',
    assetsInlineLimit: 4096,
  },
  server: {
    host: true,
    port: 5173,
  },
});
