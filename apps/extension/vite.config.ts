import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import path from 'path';

export default defineConfig({
    plugins: [
        react(),
        crx({ manifest }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    define: {
        global: 'window',
    },
    server: {
        port: 5173,
        strictPort: true,
        hmr: {
            port: 5173,
        },
    },
});
