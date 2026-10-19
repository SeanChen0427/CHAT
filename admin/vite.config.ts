import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Sean 版（Supabase）：後台放在 GitHub Pages 的 https://<帳號>.github.io/CHAT/，
// 因此預設 base 為 /CHAT/；可用 VITE_BASE 覆寫（例如本機預覽用 /）。
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/CHAT/',
  build: {
    outDir: 'dist',
  },
});
