import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';

const fontLicenses = Object.fromEntries(
  ['notoserifjp', 'bizudpgothic', 'dotgothic16'].map(name => [name,
    readFileSync(new URL(`./src/assets/fonts/${name}-OFL.txt`, import.meta.url), 'utf8'),
  ]),
);

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'bundle-font-licenses',
      transformIndexHtml: () => [{
        tag: 'script', attrs: { id: 'font-licenses', type: 'application/json' },
        children: JSON.stringify(fontLicenses).replace(/</g, '\\u003c'),
        injectTo: 'head',
      }],
    },
    viteSingleFile(),
  ],
  test: { include: ['src/**/*.test.ts'] },
});
