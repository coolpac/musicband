import { defineConfig, type PluginOption } from 'vite';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';
import viteCompression from 'vite-plugin-compression';
import { visualizer } from 'rollup-plugin-visualizer';
import { htmlPreloadPlugin } from './plugins/preload-plugin';
import { siteSsrDevPlugin } from './plugins/site-ssr-dev';

const withAnalyzer = process.env.ANALYZE === 'true';

/**
 * Two HTML entries, one build:
 *   index.html — Telegram Mini App + /admin (unchanged)
 *   site.html  — public website, server-rendered (template for server/site-server.mjs)
 * A second pass, `vite build --ssr src/site/entry-server.tsx`, produces dist-ssr/entry-server.js.
 */
export default defineConfig(({ isSsrBuild }) => {
  const clientOnlyPlugins: PluginOption[] = isSsrBuild
    ? []
    : [
        htmlPreloadPlugin(),
        ViteImageOptimizer({
          // Site photos are already encoded to AVIF/WebP at tuned quality by
          // scripts/optimize-site-images.mjs (`-w<width>` suffix) — re-encoding would only lose quality.
          exclude: /-w\d{3,4}-[\w-]+\.(?:avif|webp)$/,
          png: { quality: 80 },
          jpeg: { quality: 80 },
          jpg: { quality: 80 },
          webp: { quality: 80 },
          svg: {
            multipass: true,
            plugins: [
              {
                name: 'preset-default',
                params: {
                  overrides: {
                    removeComments: true,
                    removeMetadata: true,
                    cleanupNumericValues: false,
                    cleanupIds: { minify: false, remove: false },
                    convertPathData: false,
                  },
                },
              },
              'sortAttrs',
              {
                name: 'addAttributesToSVGElement',
                params: { attributes: [{ xmlns: 'http://www.w3.org/2000/svg' }] },
              },
            ],
          },
        }),
        viteCompression({ algorithm: 'gzip' }),
        viteCompression({ algorithm: 'brotliCompress', ext: '.br' }),
        ...(withAnalyzer
          ? [
              visualizer({
                filename: 'dist/stats.html',
                open: false,
                gzipSize: true,
                brotliSize: true,
              }),
            ]
          : []),
      ];

  return {
    plugins: [react(), siteSsrDevPlugin(), ...clientOnlyPlugins],
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom'],
    },
    // The SSR bundle is self-contained (React included): the site container ships one JS file, no node_modules.
    ssr: isSsrBuild ? { noExternal: true } : undefined,
    build: isSsrBuild
      ? {
          target: 'node20',
          minify: false,
          emptyOutDir: true,
          // Asset imports must resolve to the same hashed URLs the client build emitted.
          assetsInlineLimit: 4096,
          rollupOptions: {
            output: {
              entryFileNames: 'entry-server.js',
              assetFileNames: 'assets/[name]-[hash][extname]',
            },
          },
        }
      : {
          target: 'es2020',
          minify: 'terser',
          terserOptions: {
            compress: { drop_console: true, drop_debugger: true },
          },
          chunkSizeWarningLimit: 500,
          assetsInlineLimit: 4096,
          rollupOptions: {
            // Keep the key `index`: plugins/preload-plugin.ts looks for js/index-*.js.
            input: {
              index: resolve(__dirname, 'index.html'),
              site: resolve(__dirname, 'site.html'),
            },
            output: {
              manualChunks(id) {
                // React core — shared by the Mini App and the site
                if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/scheduler')) {
                  return 'vendor-react';
                }
                // Drag-n-drop (только для админки)
                if (id.includes('node_modules/@dnd-kit')) {
                  return 'vendor-dnd';
                }
                // Calendar (только для booking)
                if (id.includes('node_modules/react-big-calendar')) {
                  return 'vendor-calendar';
                }
                // Date utilities
                if (id.includes('node_modules/date-fns')) {
                  return 'vendor-date';
                }
              },
              assetFileNames: 'assets/[name]-[hash][extname]',
              chunkFileNames: 'js/[name]-[hash].js',
              entryFileNames: 'js/[name]-[hash].js',
            },
          },
        },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
