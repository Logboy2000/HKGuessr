import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  publicDir: '../public', // Explicitly tell Vite where the public folder is, relative to the project root
  build: {
    outDir: '../dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        admin: resolve(__dirname, 'src/admin.html'),
        game: resolve(__dirname, 'src/game.html'),
        editor: resolve(__dirname, 'src/editor.html'),
        credits: resolve(__dirname, 'src/credits.html'),
      },
    },
  },
});
