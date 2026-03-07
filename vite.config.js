import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from "@vitejs/plugin-react"
import pkg from './package.json';

export default defineConfig({
  plugins: [react()],
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
        donate: resolve(__dirname, 'donate.html'),
        discord: resolve(__dirname, 'discord.html'),
        imagePacks: resolve(__dirname, 'imagePacks.html'),
        archive: resolve(__dirname, 'archive.html')
      },
    },
  },
});
