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
      '@styles': resolve(__dirname, 'src/styles'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return null;
          if (id.includes('/@sanity/client/')) return 'sanity';
          if (id.includes('/gsap/') || id.includes('/lenis/')) return 'animation';
          if (id.includes('/three/')) return 'three';
          return null;
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
