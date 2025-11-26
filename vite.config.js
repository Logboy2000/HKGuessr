import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'public',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        game: resolve(__dirname, 'game.html'),
        editor: resolve(__dirname, 'editor.html'),
        credits: resolve(__dirname, 'credits.html'),
      },
    },
  },
});
