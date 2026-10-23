import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'api-dev-server-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!req.url?.startsWith('/api/')) {
              return next();
            }

            const cleanUrl = req.url.split('?')[0];
            let modulePath: string | null = null;

            if (cleanUrl === '/api/haze') {
              modulePath = '/api/haze.js';
            } else if (cleanUrl === '/api/health') {
              modulePath = '/api/health.ts';
            } else if (cleanUrl === '/api/psi') {
              modulePath = '/api/psi.ts';
            }

            if (modulePath) {
              try {
                const apiModule = await server.ssrLoadModule(modulePath);
                if (typeof apiModule.default === 'function') {
                  await apiModule.default(req, res);
                  return;
                }
              } catch (err) {
                console.error(`Error in ${modulePath} middleware:`, err);
                res.statusCode = 503;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    error:
                      'Service temporarily unavailable. Please try again.',
                  })
                );
                return;
              }
            }

            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
