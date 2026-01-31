import type { Plugin } from 'vite';

/**
 * Injects preload hints into index.html during production build only.
 * - Preload LCP image (hero) to start loading immediately
 * - Modulepreload main JS bundle
 * - DNS prefetch for external resources (e.g. video CDN)
 */
export function htmlPreloadPlugin(): Plugin {
  return {
    name: 'html-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html;

        const preloads: string[] = [];

        // LCP image: hero-image*.webp
        const heroAsset = Object.keys(ctx.bundle).find(
          (name) => name.includes('hero-image') && name.endsWith('.webp')
        );
        if (heroAsset) {
          preloads.push(
            `<link rel="preload" as="image" type="image/webp" href="/${heroAsset}" fetchpriority="high" />`
          );
        }

        // Main entry JS (index-*.js)
        const indexChunk = Object.keys(ctx.bundle).find(
          (name) => name.startsWith('js/') && name.includes('index-') && name.endsWith('.js')
        );
        if (indexChunk) {
          preloads.push(`<link rel="modulepreload" href="/${indexChunk}" />`);
        }

        // DNS prefetch for external resources (video, fonts already have preconnect)
        preloads.push(`<link rel="dns-prefetch" href="https://storage.googleapis.com" />`);

        if (preloads.length === 0) return html;

        return html.replace(
          '<meta charset="UTF-8" />',
          `<meta charset="UTF-8" />\n    ${preloads.join('\n    ')}`
        );
      },
    },
  };
}
